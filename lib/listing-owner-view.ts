/** True when the signed-in viewer is the seller on this listing. */
export function listingViewerIsOwner(
  userId: string | null | undefined,
  sellerUserId: string | null | undefined,
): boolean {
  return Boolean(userId && sellerUserId && userId === sellerUserId)
}
