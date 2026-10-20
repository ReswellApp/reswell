/**
 * A saved draft id can point at a listing that was published or deleted.
 * That save should start a new draft instead of failing forever.
 */
export function draftSaveTargetsStaleListing(
  status: number,
  error: string,
  hadListingId: boolean,
): boolean {
  if (!hadListingId) return false
  if (status === 404 || status === 409) return true
  return error === "Listing is not a draft" || error === "Draft not found"
}
