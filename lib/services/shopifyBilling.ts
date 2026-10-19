import type { SupabaseClient } from "@supabase/supabase-js"
import { dbUpdateShopifyBilling } from "@/lib/db/shopifyConnections"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import {
  SHOPIFY_USAGE_CAP_USD,
  SHOPIFY_USAGE_TERMS,
} from "@/lib/shopify/billing"
import { shopifyBillingTestMode } from "@/lib/shopify/config"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { publicSiteOrigin } from "@/lib/public-site-origin"
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
): Promise<void> {
  if (subscription) {
    await dbUpdateShopifyBilling(serviceSupabase, connection.id, {
      billingStatus: "active",
      subscriptionGid: subscription.id,
      lineItemGid: subscription.lineItemId,
      cappedAmount: subscription.cappedAmount,
      approvedAt: new Date().toISOString(),
      syncEnabled: true,
    })
    return
  }
  await dbUpdateShopifyBilling(serviceSupabase, connection.id, {
    billingStatus: declined ? "declined" : "pending",
    subscriptionGid: null,
    lineItemGid: null,
    cappedAmount: null,
    approvedAt: null,
    syncEnabled: false,
  })
}

/** After install or a billing return, turn sync on only when the usage charge is active. */
export async function settleShopifyBilling(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
  options?: { declined?: boolean },
): Promise<void> {
  try {
    const accessToken = await getShopifyAccessToken(serviceSupabase, connection)
    const subscription = await readShopifyUsageSubscription(
      connection.shop_domain,
      accessToken,
    )
    await saveBilling(
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
    await saveBilling(serviceSupabase, connection, null, options?.declined === true)
  }
}
