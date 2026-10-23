import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetShopifyConnectionForUser,
  dbUpdateShopifySourceOfTruth,
} from "@/lib/db/shopifyConnections"
import type { ShopifyConnectionRow, ShopifySourceOfTruth } from "@/lib/shopify/types"
import {
  createShopifyUsageChargeApproval,
  readShopifyUsageSubscription,
  settleShopifyBilling,
} from "@/lib/services/shopifyBilling"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"
import {
  listReswellListingsToPublish,
  publishReswellListingToShopify,
  type ReswellPublishCandidate,
} from "@/lib/services/shopifyReswellPublish"
import { pushShopifySourceOfTruth } from "@/lib/services/shopifySource"
import type { ServiceResult } from "@/lib/services/shopifyConnection"

type ActiveLink =
  | { ok: false; status: number; error: string }
  | {
      ok: true
      service: ReturnType<typeof createServiceRoleClient>
      connection: ShopifyConnectionRow
    }

async function activeLink(userId: string): Promise<ActiveLink> {
  const service = createServiceRoleClient()
  const connection = await dbGetShopifyConnectionForUser(service, userId)
  if (!connection || connection.status !== "active") {
    return { ok: false, status: 409, error: "Connect a Shopify store first" }
  }
  return { ok: true, service, connection }
}

export async function setMerchantShopifySource(input: {
  userId: string
  sourceOfTruth: ShopifySourceOfTruth
}): Promise<ServiceResult<{ sourceOfTruth: ShopifySourceOfTruth }>> {
  try {
    const linked = await activeLink(input.userId)
    if (!linked.ok) {
      return { ok: false, status: linked.status, error: linked.error }
    }
    await dbUpdateShopifySourceOfTruth(
      linked.service,
      linked.connection.id,
      input.sourceOfTruth,
    )
    await pushShopifySourceOfTruth({
      serviceSupabase: linked.service,
      connection: { ...linked.connection, source_of_truth: input.sourceOfTruth },
      sourceOfTruth: input.sourceOfTruth,
    })
    return { ok: true, data: { sourceOfTruth: input.sourceOfTruth } }
  } catch (error) {
    console.error("[shopify] source", error)
    return { ok: false, status: 500, error: "Could not save the source of truth" }
  }
}

export async function startMerchantShopifyBilling(input: {
  userId: string
}): Promise<ServiceResult<{ confirmationUrl: string | null }>> {
  try {
    const linked = await activeLink(input.userId)
    if (!linked.ok) {
      return { ok: false, status: linked.status, error: linked.error }
    }
    const accessToken = await getShopifyAccessToken(
      linked.service,
      linked.connection,
    )
    const existing = await readShopifyUsageSubscription(
      linked.connection.shop_domain,
      accessToken,
    )
    if (existing) {
      await settleShopifyBilling(linked.service, linked.connection)
      return { ok: true, data: { confirmationUrl: null } }
    }
    const confirmationUrl = await createShopifyUsageChargeApproval({
      shopDomain: linked.connection.shop_domain,
      accessToken,
    })
    return { ok: true, data: { confirmationUrl } }
  } catch (error) {
    console.error("[shopify] billing start", error)
    return { ok: false, status: 500, error: "Could not start Shopify billing" }
  }
}

export async function finishMerchantShopifyBilling(input: {
  userId: string
}): Promise<ServiceResult<{ billingStatus: "active" | "declined" }>> {
  try {
    const linked = await activeLink(input.userId)
    if (!linked.ok) {
      return { ok: false, status: linked.status, error: linked.error }
    }
    await settleShopifyBilling(linked.service, linked.connection, {
      declined: true,
    })
    const refreshed = await dbGetShopifyConnectionForUser(
      linked.service,
      input.userId,
    )
    return {
      ok: true,
      data: {
        billingStatus: refreshed?.billing_status === "active" ? "active" : "declined",
      },
    }
  } catch (error) {
    console.error("[shopify] billing return", error)
    return { ok: false, status: 500, error: "Could not confirm Shopify billing" }
  }
}

export async function listMerchantReswellPublishListings(input: {
  userId: string
}): Promise<ServiceResult<{ listings: ReswellPublishCandidate[] }>> {
  try {
    const linked = await activeLink(input.userId)
    if (!linked.ok) {
      return { ok: false, status: linked.status, error: linked.error }
    }
    if (linked.connection.billing_status !== "active") {
      return {
        ok: false,
        status: 409,
        error: "Approve the Shopify usage charge before syncing",
      }
    }
    if (linked.connection.source_of_truth !== "reswell") {
      return {
        ok: false,
        status: 409,
        error: "Reswell is not the source of truth for this store",
      }
    }
    const listings = await listReswellListingsToPublish({
      serviceSupabase: linked.service,
      connection: linked.connection,
    })
    return { ok: true, data: { listings } }
  } catch (error) {
    console.error("[shopify] reswell listings", error)
    return { ok: false, status: 500, error: "Could not load Reswell listings" }
  }
}

export async function publishMerchantReswellListing(input: {
  userId: string
  listingId: string
}): Promise<ServiceResult<{ listingId: string }>> {
  try {
    const linked = await activeLink(input.userId)
    if (!linked.ok) {
      return { ok: false, status: linked.status, error: linked.error }
    }
    if (linked.connection.billing_status !== "active" || !linked.connection.sync_enabled) {
      return {
        ok: false,
        status: 409,
        error: "Approve the Shopify usage charge before syncing",
      }
    }
    if (linked.connection.source_of_truth !== "reswell") {
      return {
        ok: false,
        status: 409,
        error: "Reswell is not the source of truth for this store",
      }
    }
    await publishReswellListingToShopify({
      serviceSupabase: linked.service,
      connection: linked.connection,
      listingId: input.listingId,
    })
    return { ok: true, data: { listingId: input.listingId } }
  } catch (error) {
    console.error("[shopify] publish reswell listing", error)
    return { ok: false, status: 500, error: "Could not publish this listing" }
  }
}
