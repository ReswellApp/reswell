import type { SupabaseClient } from "@supabase/supabase-js"
import { tryInsertBoardSavedSearchAlertSent, type SavedSearchRow } from "@/lib/db/savedSearches"
import { trackKlaviyoBoardAlertMatch } from "@/lib/klaviyo/track-board-alert-match"
import { savedSearchAbsoluteUrl } from "@/lib/klaviyo/saved-search-url"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { inferSavedSearchAlertKind } from "@/lib/utils/saved-search-alert-kind"
import { boardSavedSearchCriteriaSchema } from "@/lib/validations/boardSavedSearch"
import type { ListingRowForBoardAlert } from "@/lib/services/boardSavedSearchMatch"

function listingPublicPath(listing: ListingRowForBoardAlert): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

export type BoardSavedSearchAlertSendResult = "sent" | "duplicate" | "error"

/**
 * Claim the saved-search/listing pair and queue the Klaviyo alert.
 * A duplicate claim means this pair was already emailed.
 */
export async function sendBoardSavedSearchAlert(
  service: SupabaseClient,
  search: SavedSearchRow,
  listing: ListingRowForBoardAlert,
  photoUrl: string | null,
): Promise<BoardSavedSearchAlertSendResult> {
  const claim = await tryInsertBoardSavedSearchAlertSent(service, search.id, listing.id)
  if (claim.error) {
    console.error("[saved_search] alert idempotency insert:", claim.error)
    return "error"
  }
  if (!claim.inserted) return "duplicate"

  const priceNum = typeof listing.price === "number" ? listing.price : Number(listing.price ?? NaN)
  const parsedCriteria = boardSavedSearchCriteriaSchema.safeParse(search.criteria)
  const origin = publicSiteOrigin()

  void trackKlaviyoBoardAlertMatch({
    subscriberUserId: search.user_id,
    savedSearchId: search.id,
    listingId: listing.id,
    listingTitle: String(listing.title ?? ""),
    listingPrice: Number.isFinite(priceNum) ? priceNum : 0,
    listingAbsoluteUrl: `${origin}${listingPublicPath(listing)}`,
    listingPhotoUrl: photoUrl,
    brand: listing.brand,
    model: listing.model,
    dimensions: listing.dimensions,
    condition: listing.condition,
    boardType: listing.board_type,
    section: listing.section,
    alertKind: parsedCriteria.success
      ? inferSavedSearchAlertKind(parsedCriteria.data)
      : "search",
    savedSearchLabel: search.label,
    searchQuery: parsedCriteria.success ? (parsedCriteria.data.q?.trim() ?? "") : "",
    searchUrl: parsedCriteria.success ? savedSearchAbsoluteUrl(parsedCriteria.data) : "",
    criteria: parsedCriteria.success ? parsedCriteria.data : null,
  })

  return "sent"
}
