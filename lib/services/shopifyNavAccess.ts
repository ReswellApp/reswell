import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbAccountIdsWithLinkedShopifyStore,
  dbUserHasLinkedShopifyStore,
} from "@/lib/db/shopifyConnections"

/**
 * Show Shopify in dashboard nav only after an App Store install was claimed
 * (a non-disconnected shopify_connections row). Do not use the old
 * shopify_connect_enabled approval flag for discovery.
 */
export async function accountHasShopifyNavLink(
  accountId: string,
): Promise<boolean> {
  try {
    const service = createServiceRoleClient()
    return await dbUserHasLinkedShopifyStore(service, accountId)
  } catch (error) {
    console.error("[shopify] nav access", { accountId, error })
    return false
  }
}

/** Batch nav eligibility for header account switching. */
export async function accountIdsWithShopifyNavLink(
  accountIds: string[],
): Promise<Set<string>> {
  try {
    const service = createServiceRoleClient()
    return await dbAccountIdsWithLinkedShopifyStore(service, accountIds)
  } catch (error) {
    console.error("[shopify] nav access batch", { accountIds, error })
    return new Set()
  }
}
