import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbClaimShopifyPendingInstallation,
  dbGetShopifyPendingInstallationPreview,
} from "@/lib/db/shopifyPendingInstallations"
import { dbGetShopifyConnectionById } from "@/lib/db/shopifyConnections"
import { dbReviveDeadShopifyInventoryJobs } from "@/lib/db/shopifyQueue"
import { hashShopifyClaimSecret } from "@/lib/shopify/crypto"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"
import {
  getShopifyAccessToken,
  registerShopifyWebhooks,
} from "@/lib/services/shopifyOAuth"
import { dbMarkShopifyConnectionStatus } from "@/lib/db/shopifyConnections"

export async function previewShopifyPendingClaim(
  claimSecret: string | undefined | null,
): Promise<ShopifyPendingInstallationPreview | null> {
  if (!claimSecret?.trim()) return null
  const serviceSupabase = createServiceRoleClient()
  return dbGetShopifyPendingInstallationPreview(
    serviceSupabase,
    hashShopifyClaimSecret(claimSecret.trim()),
  )
}

export async function claimShopifyPendingInstallation(input: {
  userId: string
  claimSecret: string
}): Promise<{ connectionId: string; shopDomain: string }> {
  const serviceSupabase = createServiceRoleClient()
  const claimed = await dbClaimShopifyPendingInstallation(serviceSupabase, {
    claimSecretHash: hashShopifyClaimSecret(input.claimSecret.trim()),
    userId: input.userId,
  })

  const connection = await dbGetShopifyConnectionById(
    serviceSupabase,
    claimed.connectionId,
  )
  if (!connection) {
    throw new Error("Shopify connection was not found after claim")
  }

  await dbReviveDeadShopifyInventoryJobs(serviceSupabase, connection.id)

  try {
    const accessToken = await getShopifyAccessToken(serviceSupabase, connection)
    await registerShopifyWebhooks(connection.shop_domain, accessToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
      status: "error",
      syncEnabled: false,
      error: `Webhook setup failed: ${message}`,
    })
    throw error
  }

  return {
    connectionId: claimed.connectionId,
    shopDomain: claimed.shopDomain,
  }
}
