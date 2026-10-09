import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetShopifyAccessRequestState,
  dbInsertShopifyAccessRequest,
  dbMarkShopifyConnectRequested,
} from "@/lib/db/shopifyAccessRequests"
import { previewShopifyPendingClaim } from "@/lib/services/shopifyClaim"
import { normalizeShopifyDomain } from "@/lib/shopify/config"

export async function getShopifyAccessRequestState(userId: string): Promise<{
  shopifyConnectEnabled: boolean
  requestedAt: string | null
}> {
  const serviceSupabase = createServiceRoleClient()
  return dbGetShopifyAccessRequestState(serviceSupabase, userId)
}

export type ShopifyAccessRequestResult =
  | { success: true; alreadyRequested: boolean }
  | { error: string }

export async function requestShopifyPluginAccess(input: {
  userId: string
  claimSecret?: string | null
}): Promise<ShopifyAccessRequestResult> {
  const serviceSupabase = createServiceRoleClient()
  const state = await dbGetShopifyAccessRequestState(serviceSupabase, input.userId)
  if (state.shopifyConnectEnabled) {
    return { error: "Your account already has Shopify plugin access." }
  }

  const preview = await previewShopifyPendingClaim(input.claimSecret)
  const shopDomain = preview?.shopDomain
    ? normalizeShopifyDomain(preview.shopDomain)
    : null
  const inserted = await dbInsertShopifyAccessRequest(serviceSupabase, {
    userId: input.userId,
    shopDomain,
    shopName: preview?.shopName?.trim() || null,
  })
  await dbMarkShopifyConnectRequested(serviceSupabase, input.userId)
  return {
    success: true,
    alreadyRequested: inserted === "already_pending" || Boolean(state.requestedAt),
  }
}
