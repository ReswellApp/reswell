import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbSetShopifyAccessForUser } from "@/lib/db/adminShopifyAccess"
import { dbMarkPendingShopifyAccessRequestsGranted } from "@/lib/db/shopifyAccessRequests"
import { disconnectMerchantShopify } from "@/lib/services/shopifyConnection"

export async function setShopifyAccessForUser(
  userId: string,
  grant: boolean,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    if (!grant) {
      const disconnected = await disconnectMerchantShopify(userId)
      if (!disconnected.ok) {
        return {
          ok: false,
          status: disconnected.status,
          error: disconnected.error,
        }
      }
    }
    const serviceSupabase = createServiceRoleClient()
    const result = await dbSetShopifyAccessForUser(
      serviceSupabase,
      userId,
      grant,
    )
    if (result === "not_found") {
      return { ok: false, status: 404, error: "User not found" }
    }
    if (grant) {
      await dbMarkPendingShopifyAccessRequestsGranted(serviceSupabase, userId)
    }
    return { ok: true }
  } catch (error) {
    console.error("[adminShopifyAccess]", error)
    return { ok: false, status: 500, error: "Could not update Shopify access" }
  }
}
