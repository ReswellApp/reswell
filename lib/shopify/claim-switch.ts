/** Same-shop reconnect retries inventory jobs. A different shop must not. */
export function shopifyClaimShouldReviveInventory(
  previousShopDomain: string | null,
  claimedShopDomain: string,
): boolean {
  if (!previousShopDomain) return true
  return previousShopDomain.toLowerCase() === claimedShopDomain.toLowerCase()
}
