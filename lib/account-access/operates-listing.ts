/**
 * A person operates a listing when they own it, or they are currently working
 * inside the shop account that owns it.
 */
export function listingOwnerIsOperableAccount(
  actorUserId: string,
  listingOwnerId: string | null | undefined,
  actingShopAccountId: string | null | undefined,
): boolean {
  const ownerId = listingOwnerId?.trim()
  const actorId = actorUserId.trim()
  if (!ownerId || !actorId) return false
  if (actorId === ownerId) return true
  const shopId = actingShopAccountId?.trim()
  return Boolean(shopId && shopId === ownerId)
}
