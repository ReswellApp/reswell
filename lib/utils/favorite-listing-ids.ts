import { isUuidString } from "./isUuid.ts"

/** Deduped UUIDs for a favorites `.in("listing_id", …)` filter. Empty → skip the query. */
export function listingIdsEligibleForFavoriteLookup(
  listingIds: readonly string[],
): string[] {
  return [...new Set(listingIds.filter((id) => isUuidString(id)))]
}
