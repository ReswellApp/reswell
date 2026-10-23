import { listingOwnerIsOperableAccount } from "@/lib/account-access/operates-listing"
import { getShopAccountContext } from "@/lib/services/accountAccess"

/**
 * Shop members insert listings as themselves; a DB trigger rewrites `user_id`
 * to the shop. Later draft updates must treat that shop as the owner.
 */
async function actingShopForDraftWrite(actorUserId: string): Promise<string | null> {
  try {
    const shop = await getShopAccountContext()
    if (!shop || shop.actorUserId !== actorUserId) return null
    if (!shop.actingAsShop) return null
    if (!shop.permissions.has("listings.write")) return null
    return shop.accountId
  } catch {
    return null
  }
}

export async function resolveDraftListingOwnerId(actorUserId: string): Promise<string> {
  return (await actingShopForDraftWrite(actorUserId)) ?? actorUserId
}

export async function assertListingDraftOwnedByActor(
  listingOwnerId: string,
  actorUserId: string,
): Promise<void> {
  const actingShopAccountId = await actingShopForDraftWrite(actorUserId)
  if (!listingOwnerIsOperableAccount(actorUserId, listingOwnerId, actingShopAccountId)) {
    throw new Error("Forbidden")
  }
}
