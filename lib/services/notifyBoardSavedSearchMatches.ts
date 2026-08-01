import {
  fetchBoardSavedSearchesWithEmailEnabled,
  tryInsertBoardSavedSearchAlertSent,
} from "@/lib/db/savedSearches"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoBoardAlertMatch } from "@/lib/klaviyo/track-board-alert-match"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import {
  ensureListingIndexedForSavedSearchAlerts,
  listingMatchesSavedSearch,
  type ListingRowForBoardAlert,
} from "@/lib/services/boardSavedSearchMatch"

export type { ListingRowForBoardAlert }
export { listingMatchesBoardSavedCriteria } from "@/lib/services/boardSavedSearchMatch"

function listingPublicPath(listing: ListingRowForBoardAlert): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

/**
 * When a peer listing goes live, notify users whose saved searches would return that listing.
 */
export async function notifyBoardSavedSearchMatchesForListing(
  listingId: string,
): Promise<{ attempted: number; sent: number; skippedReason?: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { attempted: 0, sent: 0, skippedReason: "missing_service_role" }
  }

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select(
      "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug, fins_setup, fin_system, fin_size, wetsuit_size, apparel_kind, magazine_year",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_found" }
  }

  const row = listing as ListingRowForBoardAlert

  if (!isPeerListingSection(row.section) || row.status !== "active" || row.hidden_from_site) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_alertable" }
  }

  if (row.section === "surfboards") {
    await ensureListingIndexedForSavedSearchAlerts(listingId)
  }

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(
    service,
    { section: row.section },
  )
  if (searchErr) {
    console.error("[saved_search] fetch enabled searches:", searchErr)
    return { attempted: 0, sent: 0, skippedReason: "fetch_searches_failed" }
  }

  const candidates = searches.filter((s) => s.user_id !== row.user_id)
  const eligible: typeof candidates = []
  for (const s of candidates) {
    const matches = await listingMatchesSavedSearch(listingId, row, s.criteria)
    if (matches) eligible.push(s)
  }

  const origin = publicSiteOrigin()

  const { data: firstImage } = await service
    .from("listing_images")
    .select("url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const photoUrl =
    (firstImage?.thumbnail_url && String(firstImage.thumbnail_url).trim()) ||
    (firstImage?.url && String(firstImage.url).trim()) ||
    null

  let sent = 0
  for (const sub of eligible) {
    const claim = await tryInsertBoardSavedSearchAlertSent(service, sub.id, listingId)
    if (claim.error) {
      console.error("[saved_search] alert idempotency insert:", claim.error)
      continue
    }
    if (!claim.inserted) continue

    const priceNum = typeof row.price === "number" ? row.price : Number(row.price ?? NaN)

    void trackKlaviyoBoardAlertMatch({
      subscriberUserId: sub.user_id,
      savedSearchId: sub.id,
      listingId: row.id,
      listingTitle: String(row.title ?? ""),
      listingPrice: Number.isFinite(priceNum) ? priceNum : 0,
      listingAbsoluteUrl: `${origin}${listingPublicPath(row)}`,
      listingPhotoUrl: photoUrl,
      brand: row.brand,
      model: row.model,
      dimensions: row.dimensions,
      condition: row.condition,
      boardType: row.board_type,
      section: row.section,
    })
    sent += 1
  }

  return { attempted: eligible.length, sent }
}
