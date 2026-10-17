import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbApproveShopifyInstallClaimant,
  dbClaimShopifyPendingInstallation,
  dbGetShopifyPendingInstallationPreview,
} from "@/lib/db/shopifyPendingInstallations"
import {
  dbGetShopifyConnectionById,
  dbGetShopifyConnectionForUser,
  dbMarkShopifyConnectionStatus,
} from "@/lib/db/shopifyConnections"
import { dbUnpublishAllShopifyListingsForConnection } from "@/lib/db/shopifyCatalog"
import {
  dbCancelShopifyInventoryJobsForConnection,
  dbReviveDeadShopifyInventoryJobs,
} from "@/lib/db/shopifyQueue"
import { hashShopifyClaimSecret } from "@/lib/shopify/crypto"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"
import { applyShopifyListingSideEffects } from "@/lib/services/shopifyCatalog"
import {
  getShopifyAccessToken,
  registerShopifyWebhooks,
} from "@/lib/services/shopifyOAuth"
import { shopifyClaimShouldReviveInventory } from "@/lib/shopify/claim-switch"

const SHOP_MOVE_INVENTORY_CANCEL_REASON =
  "Canceled because this Reswell account connected a different Shopify store"

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
  const claimSecretHash = hashShopifyClaimSecret(input.claimSecret.trim())
  const previous = await dbGetShopifyConnectionForUser(
    serviceSupabase,
    input.userId,
  )
  await dbApproveShopifyInstallClaimant(serviceSupabase, {
    claimSecretHash,
    userId: input.userId,
  })
  const claimed = await dbClaimShopifyPendingInstallation(serviceSupabase, {
    claimSecretHash,
    userId: input.userId,
  })

  const connection = await dbGetShopifyConnectionById(
    serviceSupabase,
    claimed.connectionId,
  )
  if (!connection) {
    throw new Error("Shopify connection was not found after claim")
  }

  if (
    shopifyClaimShouldReviveInventory(
      previous?.shop_domain ?? null,
      claimed.shopDomain,
    )
  ) {
    await dbReviveDeadShopifyInventoryJobs(serviceSupabase, connection.id)
  } else {
    const listingIds = await dbUnpublishAllShopifyListingsForConnection(
      serviceSupabase,
      connection.id,
    )
    await dbCancelShopifyInventoryJobsForConnection(
      serviceSupabase,
      connection.id,
      SHOP_MOVE_INVENTORY_CANCEL_REASON,
    )
    await applyShopifyListingSideEffects(serviceSupabase, listingIds)
  }

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
