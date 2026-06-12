import {
  fetchOpenBoardListingRequests,
  markBoardListingRequestFulfilled,
  tryInsertBoardListingRequestAlertSent,
  type BoardListingRequestRow,
} from "@/lib/db/boardListingRequests"
import { trackKlaviyoBoardListingMatch } from "@/lib/klaviyo/track-board-listing-match"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { boardSavedSearchCriteriaSchema } from "@/lib/validations/boardSavedSearch"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  listingMatchesBoardSavedCriteria,
  type ListingRowForBoardAlert,
} from "@/lib/services/notifyBoardSavedSearchMatches"

const LISTING_SELECT =
  "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug"

export function listingMatchesBoardListingRequest(
  listing: ListingRowForBoardAlert,
  request: Pick<BoardListingRequestRow, "query" | "criteria">,
): boolean {
  const parsed = boardSavedSearchCriteriaSchema.safeParse(request.criteria)
  const criteria = parsed.success ? parsed.data : {}
  const mergedCriteria = {
    ...criteria,
    q: criteria.q?.trim() || request.query?.trim() || undefined,
  }
  return listingMatchesBoardSavedCriteria(listing, mergedCriteria)
}

function listingPublicPath(listing: ListingRowForBoardAlert): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

export async function notifyBoardListingRequestMatchesForListing(
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
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_found" }
  }

  const row = listing as ListingRowForBoardAlert

  const { data: requests, error: requestErr } = await fetchOpenBoardListingRequests(service)
  if (requestErr) {
    console.error("[board_listing_request] fetch open requests:", requestErr)
    return { attempted: 0, sent: 0, skippedReason: "fetch_requests_failed" }
  }

  const eligible = requests.filter((r) => {
    if (r.user_id && r.user_id === row.user_id) return false
    return listingMatchesBoardListingRequest(row, r)
  })

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

  for (const request of eligible) {
    const claim = await tryInsertBoardListingRequestAlertSent(service, request.id, listingId)
    if (claim.error) {
      console.error("[board_listing_request] alert idempotency insert:", claim.error)
      continue
    }
    if (!claim.inserted) continue

    const parsedCriteria = boardSavedSearchCriteriaSchema.safeParse(request.criteria)
    const criteria = parsedCriteria.success ? parsedCriteria.data : {}
    const summary = boardSavedSearchCriteriaSummary({
      ...criteria,
      q: criteria.q?.trim() || request.query?.trim() || undefined,
    })

    const priceNum = typeof row.price === "number" ? row.price : Number(row.price ?? NaN)

    try {
      await trackKlaviyoBoardListingMatch({
        email: request.email,
        requesterUserId: request.user_id,
        requestId: request.id,
        query: request.query,
        summary,
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
      })
    } catch (e) {
      console.error("[board_listing_request] Klaviyo match event failed:", e)
      continue
    }

    const { error: fulfillErr } = await markBoardListingRequestFulfilled(service, request.id)
    if (fulfillErr) {
      console.error("[board_listing_request] mark fulfilled:", fulfillErr)
    }

    sent += 1
  }

  return { attempted: eligible.length, sent }
}

export type BoardListingRequestMatchesCronSummary = {
  listings_scanned: number
  notifications_attempted: number
  notifications_sent: number
}

/** Scans surfboard listings created in the last `windowHours` against open demand-capture rows. */
export async function runBoardListingRequestMatchesCron(
  windowHours = 24,
): Promise<BoardListingRequestMatchesCronSummary> {
  const service = createServiceRoleClient()
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const { data: listings, error } = await service
    .from("listings")
    .select("id")
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  let notificationsAttempted = 0
  let notificationsSent = 0

  for (const listing of listings ?? []) {
    const result = await notifyBoardListingRequestMatchesForListing(listing.id)
    notificationsAttempted += result.attempted
    notificationsSent += result.sent
  }

  return {
    listings_scanned: listings?.length ?? 0,
    notifications_attempted: notificationsAttempted,
    notifications_sent: notificationsSent,
  }
}
