import type { SupabaseClient } from "@supabase/supabase-js"
import { dbHoldShopifyListingsForBilling } from "@/lib/db/shopifyCatalog"
import { dbUpdateShopifyBilling } from "@/lib/db/shopifyConnections"
import { loadListingInventorySources } from "@/lib/db/listingInventorySource"
import { dbEnqueueShopifyJob } from "@/lib/db/shopifyQueue"
import { dbListShopifyBilledListingIds } from "@/lib/db/shopifySales"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import {
  SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE,
  SHOPIFY_USAGE_CAP_USD,
  SHOPIFY_USAGE_TERMS,
} from "@/lib/shopify/billing"
import { shopifyBillingTestMode } from "@/lib/shopify/config"
import { applyShopifyListingSideEffects } from "@/lib/services/shopifyCatalog"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"
import { pushShopifySourceOfTruth } from "@/lib/services/shopifySource"

export class ShopifyBillingRequiredError extends Error {
  constructor() {
    super("Shopify usage charge is not approved")
    this.name = "ShopifyBillingRequiredError"
  }
}

type UsageSubscription = {
  id: string
  lineItemId: string
  cappedAmount: number | null
}

type ActiveSubscriptionNode = {
  id?: string | null
  status?: string | null
  lineItems?: Array<{
    id?: string | null
    plan?: {
      pricingDetails?: {
        __typename?: string | null
        cappedAmount?: { amount?: string | null } | null
      } | null
    } | null
  }> | null
}

function usageLine(subscription: ActiveSubscriptionNode): UsageSubscription | null {
  if (subscription.status !== "ACTIVE" || !subscription.id) return null
  const line = subscription.lineItems?.find(
    (item) => item.plan?.pricingDetails?.__typename === "AppUsagePricing" && item.id,
  )
  if (!line?.id) return null
  const amount = Number(line.plan?.pricingDetails?.cappedAmount?.amount)
  return {
    id: subscription.id,
    lineItemId: line.id,
    cappedAmount: Number.isFinite(amount) ? amount : null,
  }
}

export async function readShopifyUsageSubscription(
  shopDomain: string,
  accessToken: string,
): Promise<UsageSubscription | null> {
  const data = await shopifyGraphqlRequest<{
    currentAppInstallation: {
      activeSubscriptions: ActiveSubscriptionNode[]
    }
  }>({
    shopDomain,
    accessToken,
    query: `
      query ReswellAppBilling {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppUsagePricing {
                    cappedAmount { amount }
                  }
                }
              }
            }
          }
        }
      }
    `,
  })
  for (const subscription of data.currentAppInstallation.activeSubscriptions) {
    const usage = usageLine(subscription)
    if (usage) return usage
  }
  return null
}

export function shopifyBillingReturnUrl(shopDomain: string): string {
  const url = new URL("/api/integrations/shopify/billing/return", publicSiteOrigin())
  url.searchParams.set("shop", shopDomain)
  return url.toString()
}

export async function createShopifyUsageChargeApproval(input: {
  shopDomain: string
  accessToken: string
}): Promise<string> {
  const data = await shopifyGraphqlRequest<{
    appSubscriptionCreate: {
      confirmationUrl?: string | null
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      mutation ReswellUsageSubscription($name: String!, $returnUrl: URL!, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          lineItems: $lineItems
        ) {
          confirmationUrl
          userErrors { field message }
        }
      }
    `,
    variables: {
      name: "Reswell 7% sales fee",
      returnUrl: shopifyBillingReturnUrl(input.shopDomain),
      test: shopifyBillingTestMode(),
      lineItems: [
        {
          plan: {
            appUsagePricingDetails: {
              cappedAmount: {
                amount: SHOPIFY_USAGE_CAP_USD,
                currencyCode: "USD",
              },
              terms: SHOPIFY_USAGE_TERMS,
            },
          },
        },
      ],
    },
  })
  throwOnShopifyUserErrors(data.appSubscriptionCreate.userErrors)
  const confirmationUrl = data.appSubscriptionCreate.confirmationUrl?.trim()
  if (!confirmationUrl) {
    throw new Error("Shopify did not return a billing approval link")
  }
  return confirmationUrl
}

export async function createShopifyUsageRecord(input: {
  shopDomain: string
  accessToken: string
  subscriptionLineItemId: string
  orderId: string
  amountUsd: number
}): Promise<string> {
  const data = await shopifyGraphqlRequest<{
    appUsageRecordCreate: {
      appUsageRecord?: { id?: string | null } | null
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    idempotencyKey: input.orderId,
    query: `
      mutation ReswellUsageRecord(
        $description: String!
        $idempotencyKey: String!
        $price: MoneyInput!
        $subscriptionLineItemId: ID!
      ) {
        appUsageRecordCreate(
          description: $description
          idempotencyKey: $idempotencyKey
          price: $price
          subscriptionLineItemId: $subscriptionLineItemId
        ) {
          appUsageRecord { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      description: `Reswell sale ${input.orderId}: 7% of the item price`,
      idempotencyKey: input.orderId,
      price: {
        amount: input.amountUsd.toFixed(2),
        currencyCode: "USD",
      },
      subscriptionLineItemId: input.subscriptionLineItemId,
    },
  })
  throwOnShopifyUserErrors(data.appUsageRecordCreate.userErrors)
  const id = data.appUsageRecordCreate.appUsageRecord?.id?.trim()
  if (!id) throw new Error("Shopify did not return a usage record")
  return id
}

async function saveBilling(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
  subscription: UsageSubscription | null,
  declined: boolean,
): Promise<"active" | "inactive"> {
  if (subscription) {
    await dbUpdateShopifyBilling(serviceSupabase, connection.id, {
      billingStatus: "active",
      subscriptionGid: subscription.id,
      lineItemGid: subscription.lineItemId,
      cappedAmount: subscription.cappedAmount,
      approvedAt: new Date().toISOString(),
      syncEnabled: true,
    })
    return "active"
  }
  await dbUpdateShopifyBilling(serviceSupabase, connection.id, {
    billingStatus: declined ? "declined" : "pending",
    subscriptionGid: null,
    lineItemGid: null,
    cappedAmount: null,
    approvedAt: null,
    syncEnabled: false,
  })
  return "inactive"
}

async function applyBillingSaleGate(
  serviceSupabase: SupabaseClient,
  connectionId: string,
  outcome: "active" | "inactive",
): Promise<void> {
  if (outcome === "active") {
    try {
      await dbEnqueueShopifyJob(serviceSupabase, {
        connectionId,
        jobType: "reconcile_connection",
        payload: { connectionId },
        dedupeKey: `reconcile:${connectionId}`,
      })
    } catch (error) {
      console.error("[shopify] billing reconcile", { connectionId, error })
    }
    return
  }
  const listingIds = await dbHoldShopifyListingsForBilling(
    serviceSupabase,
    connectionId,
  )
  await applyShopifyListingSideEffects(serviceSupabase, listingIds)
}

/** After install or a billing return, turn sync on only when the usage charge is active. */
export async function settleShopifyBilling(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
  options?: { declined?: boolean },
): Promise<void> {
  let outcome: "active" | "inactive" = "inactive"
  try {
    const accessToken = await getShopifyAccessToken(serviceSupabase, connection)
    const subscription = await readShopifyUsageSubscription(
      connection.shop_domain,
      accessToken,
    )
    outcome = await saveBilling(
      serviceSupabase,
      connection,
      subscription,
      options?.declined === true && !subscription,
    )
    await pushShopifySourceOfTruth({
      serviceSupabase,
      connection,
      accessToken,
      sourceOfTruth: connection.source_of_truth ?? "shopify",
    })
  } catch (error) {
    console.error("[shopify] billing settle", {
      connectionId: connection.id,
      error,
    })
    outcome = await saveBilling(
      serviceSupabase,
      connection,
      null,
      options?.declined === true,
    )
  }
  await applyBillingSaleGate(serviceSupabase, connection.id, outcome)
}

/**
 * Shopify-managed listings are not for sale unless that shop's usage charge is active.
 * Inventory source is read with the service role so a caller that did not attach it
 * cannot fall through to a Stripe marketplace fee. `billedListingIds` is the subset
 * that may use the Shopify usage fee. Other listings are ignored.
 */
export async function shopifyManagedCheckoutBilling(
  listings: Array<{ id: string; inventory_source?: string | null }>,
): Promise<
  | { ok: true; billedListingIds: Set<string> }
  | { ok: false; error: string }
> {
  const ids = [
    ...new Set(listings.map((listing) => listing.id).filter((id) => id.length > 0)),
  ]
  if (ids.length === 0) return { ok: true, billedListingIds: new Set() }

  const callerSource = new Map(
    listings.map((listing) => [listing.id, listing.inventory_source]),
  )
  let managedIds: string[]
  let serviceSupabase: ReturnType<typeof createServiceRoleClient>
  try {
    serviceSupabase = createServiceRoleClient()
    const loaded = await loadListingInventorySources(serviceSupabase, ids)
    if (!loaded.ok) {
      return { ok: false, error: SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE }
    }
    managedIds = ids.filter((id) => {
      const source = loaded.sources.has(id)
        ? loaded.sources.get(id)
        : callerSource.get(id)
      return source === "shopify"
    })
  } catch (error) {
    console.error("[shopify] sale billing check", error)
    return { ok: false, error: SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE }
  }
  if (managedIds.length === 0) return { ok: true, billedListingIds: new Set() }

  let billed: string[]
  try {
    billed = await dbListShopifyBilledListingIds(serviceSupabase, managedIds)
  } catch (error) {
    console.error("[shopify] sale billing check", error)
    return { ok: false, error: SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE }
  }
  const billedListingIds = new Set(billed)
  if (!managedIds.every((id) => billedListingIds.has(id))) {
    return { ok: false, error: SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE }
  }
  return { ok: true, billedListingIds }
}
