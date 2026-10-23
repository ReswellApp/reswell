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
  type SavedSearchMatchCache,
} from "@/lib/services/boardSavedSearchMatch"
import { savedSearchAbsoluteUrl } from "@/lib/klaviyo/saved-search-url"
import { resolveBoardAlertPhotoUrl } from "@/lib/services/resolveBoardAlertPhoto"
import {
  boardAlertListingContent,
  listingListedAfterSavedSearch,
  parseAlertTimestamp,
} from "@/lib/services/savedSearchAlertEligibility"
import { inferSavedSearchAlertKind } from "@/lib/utils/saved-search-alert-kind"
import { boardSavedSearchCriteriaSchema } from "@/lib/validations/boardSavedSearch"

export type { ListingRowForBoardAlert }
export { listingMatchesBoardSavedCriteria } from "@/lib/services/boardSavedSearchMatch"

function listingPublicPath(listing: ListingRowForBoardAlert): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

function timestampString(value: unknown): string | null {
  if (typeof value === "string" && parseAlertTimestamp(value)) return value.trim()
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  return null
}

/**
 * When the listing first went live. Falls back to `listings.created_at` when the
 * creation-event row is missing. Unknown times are not alertable.
 */
async function resolveListingListedAt(
  service: ReturnType<typeof createServiceRoleClient>,
  listingId: string,
  createdAt: unknown,
): Promise<string | null> {
  const { data, error } = await service
    .from("listing_creation_events")
    .select("listed_at")
    .eq("listing_id", listingId)
    .maybeSingle()

  if (error) {
    console.error("[saved_search] listing listed_at lookup failed:", error.message)
  }

  return timestampString(data?.listed_at) ?? timestampString(createdAt)
}

/**
 * When a peer listing goes live, notify saved searches that were saved before
 * that listing and that would return it. Never sends without a title, price, and link.
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
      "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug, fins_setup, fin_system, fin_size, wetsuit_size, boardbag_size, surfpack_size, leash_size, apparel_kind, magazine_year, traction_size, created_at",
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

  const listedAt = await resolveListingListedAt(
    service,
    listingId,
    (listing as { created_at?: string | null }).created_at,
  )
  const origin = publicSiteOrigin()
  const content = boardAlertListingContent({
    title: row.title,
    price: row.price,
    listingUrl: `${origin}${listingPublicPath(row)}`,
  })
  if (!listedAt || !content) {
    return {
      attempted: 0,
      sent: 0,
      skippedReason: !content ? "listing_incomplete" : "listing_listed_at_unknown",
    }
  }

  await ensureListingIndexedForSavedSearchAlerts(listingId)

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(
    service,
    { section: row.section, createdBefore: listedAt },
  )
  if (searchErr) {
    console.error("[saved_search] fetch enabled searches:", searchErr)
    return { attempted: 0, sent: 0, skippedReason: "fetch_searches_failed" }
  }

  const candidates = searches.filter((s) => s.user_id !== row.user_id)
  const eligible: typeof candidates = []
  const matchCache: SavedSearchMatchCache = {
    marketplaceParses: new Map(),
    searchWinners: new Map(),
  }
  for (const s of candidates) {
    if (!listingListedAfterSavedSearch(listedAt, s.created_at)) continue
    const matches = await listingMatchesSavedSearch(listingId, row, s.criteria, matchCache)
    if (matches) eligible.push(s)
  }

  if (eligible.length === 0) {
    return { attempted: 0, sent: 0 }
  }

  const { data: firstImage } = await service
    .from("listing_images")
    .select("url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const storedPhotoUrl = firstImage?.url ? String(firstImage.url) : null
  const storedThumbUrl = firstImage?.thumbnail_url ? String(firstImage.thumbnail_url) : null
  const photoUrl = await resolveBoardAlertPhotoUrl(storedPhotoUrl, storedThumbUrl)
  if ((storedPhotoUrl?.trim() || storedThumbUrl?.trim()) && !photoUrl) {
    console.warn("[saved_search] omitted listing photo; storage object missing", {
      listingId,
    })
  }

  let sent = 0
  for (const sub of eligible) {
    const claim = await tryInsertBoardSavedSearchAlertSent(service, sub.id, listingId)
    if (claim.error) {
      console.error("[saved_search] alert idempotency insert:", claim.error)
      continue
    }
    if (!claim.inserted) continue

    const parsedCriteria = boardSavedSearchCriteriaSchema.safeParse(sub.criteria)

    void trackKlaviyoBoardAlertMatch({
      subscriberUserId: sub.user_id,
      savedSearchId: sub.id,
      listingId: row.id,
      listingTitle: content.title,
      listingPrice: content.price,
      listingAbsoluteUrl: content.listingUrl,
      listingPhotoUrl: photoUrl,
      brand: row.brand,
      model: row.model,
      dimensions: row.dimensions,
      condition: row.condition,
      boardType: row.board_type,
      section: row.section,
      alertKind: parsedCriteria.success
        ? inferSavedSearchAlertKind(parsedCriteria.data)
        : "search",
      savedSearchLabel: sub.label,
      searchQuery: parsedCriteria.success ? (parsedCriteria.data.q?.trim() ?? "") : "",
      searchUrl: parsedCriteria.success ? savedSearchAbsoluteUrl(parsedCriteria.data) : "",
      criteria: parsedCriteria.success ? parsedCriteria.data : null,
    })
    sent += 1
  }

  return { attempted: eligible.length, sent }
}
