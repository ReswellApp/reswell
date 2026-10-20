import { fetchBoardSavedSearchesWithEmailEnabled } from "@/lib/db/savedSearches"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { listingListedAfterSavedSearch } from "@/lib/services/boardSavedSearchAlertWindow"
import {
  ensureListingIndexedForSavedSearchAlerts,
  listingMatchesSavedSearch,
  surfboardAlertIndexState,
  type ListingRowForBoardAlert,
} from "@/lib/services/boardSavedSearchMatch"
import { sendBoardSavedSearchAlert } from "@/lib/services/sendBoardSavedSearchAlert"

export type NotifyBoardSavedSearchResult = {
  attempted: number
  sent: number
  skippedReason?: string
  /** Deliver this listing again. The index is late, or the publish time was not readable yet. */
  retry: boolean
}

export type { ListingRowForBoardAlert }
export { listingMatchesBoardSavedCriteria } from "@/lib/services/boardSavedSearchMatch"

/**
 * When a peer listing goes live, notify users whose saved searches would return that listing.
 * Surfboard alerts only go out when the board was first published after the search was saved.
 * `retry` means the search index does not have the surfboard yet. The caller delivers again.
 */
export async function notifyBoardSavedSearchMatchesForListing(
  listingId: string,
): Promise<NotifyBoardSavedSearchResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (err) {
    console.error("[saved_search] missing service role:", err)
    throw err
  }

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select(
      "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug, fins_setup, fin_system, fin_size, wetsuit_size, apparel_kind, magazine_year",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr) {
    console.error("[saved_search] load listing:", listingErr)
    throw new Error(listingErr.message)
  }
  if (!listing) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_found", retry: false }
  }

  const row = listing as ListingRowForBoardAlert

  if (!isPeerListingSection(row.section) || row.status !== "active" || row.hidden_from_site) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_alertable", retry: false }
  }

  let listedAt: string | null = null
  let indexReady = false
  let retry = false
  if (row.section === "surfboards") {
    await ensureListingIndexedForSavedSearchAlerts(listingId)
    const { data: createdEvent, error: createdErr } = await service
      .from("listing_creation_events")
      .select("listed_at")
      .eq("listing_id", listingId)
      .maybeSingle()
    if (createdErr) {
      console.error("[saved_search] listing listed_at:", createdErr)
      throw new Error(createdErr.message)
    }
    listedAt = createdEvent?.listed_at ? String(createdEvent.listed_at) : null
    if (!listedAt) {
      return { attempted: 0, sent: 0, skippedReason: "listing_not_newly_listed", retry: true }
    }
    const indexState = await surfboardAlertIndexState(listingId)
    indexReady = indexState === "ready"
    retry = indexState === "pending"
  }

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(
    service,
    { section: row.section },
  )
  if (searchErr) {
    console.error("[saved_search] fetch enabled searches:", searchErr)
    throw new Error(searchErr.message)
  }

  const candidates = searches.filter((s) => {
    if (s.user_id === row.user_id) return false
    if (row.section === "surfboards" && !listingListedAfterSavedSearch(listedAt, s.created_at)) {
      return false
    }
    return true
  })
  const eligible: typeof candidates = []
  for (const s of candidates) {
    const matches = await listingMatchesSavedSearch(listingId, row, s.criteria, {
      indexReady: row.section === "surfboards" ? indexReady : undefined,
    })
    if (matches) eligible.push(s)
  }

  const { data: firstImage } = await service
    .from("listing_images")
    .select("url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const photoUrl =
    (firstImage?.url && String(firstImage.url).trim()) ||
    (firstImage?.thumbnail_url && String(firstImage.thumbnail_url).trim()) ||
    null

  let sent = 0
  for (const sub of eligible) {
    const result = await sendBoardSavedSearchAlert(service, sub, row, photoUrl)
    if (result === "sent") sent += 1
  }

  return { attempted: eligible.length, sent, retry }
}
