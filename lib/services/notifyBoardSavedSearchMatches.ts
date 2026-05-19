import { boardSavedSearchCriteriaSchema } from "@/lib/validations/boardSavedSearch"
import { boardTypeForDbFromBrowseParam } from "@/lib/marketplace-slug-metadata"
import {
  boardDimensionBrowseIlikeTokens,
  boardDimensionBrowseFieldsFromSearchParams,
} from "@/lib/utils/board-dimension-browse-filter"
import {
  fetchBoardSavedSearchesWithEmailEnabled,
  tryInsertBoardSavedSearchAlertSent,
} from "@/lib/db/boardSavedSearches"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoBoardAlertMatch } from "@/lib/klaviyo/track-board-alert-match"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type ListingRowForBoardAlert = {
  id: string
  user_id: string
  section: string | null
  status: string | null
  hidden_from_site?: boolean | null
  title: string | null
  description?: string | null
  price: number | string | null
  brand?: string | null
  model?: string | null
  dimensions?: string | null
  board_type?: string | null
  condition?: string | null
  brand_id?: string | null
  brand_model_id?: string | null
  slug?: string | null
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

function includesInsensitive(haystack: string | null | undefined, needle: string | undefined): boolean {
  const n = (needle ?? "").trim()
  if (!n) return true
  return norm(haystack).includes(n.toLowerCase())
}

function keywordMatchesListing(listing: ListingRowForBoardAlert, q: string | undefined): boolean {
  const needle = (q ?? "").trim()
  if (!needle) return true
  const n = needle.toLowerCase()
  const blob = [
    listing.title,
    listing.description,
    listing.brand,
    listing.model,
    listing.dimensions,
  ]
    .map((x) => norm(x))
    .join(" ")
  return blob.includes(n)
}

function boardTypeMatches(criteriaType: string | undefined, listingBoardType: string | null | undefined): boolean {
  if (!criteriaType || criteriaType === "all") return true
  const expected = boardTypeForDbFromBrowseParam(criteriaType)
  if (!expected) return true
  return (listingBoardType ?? "").trim() === expected
}

function conditionMatches(criteriaCondition: string | undefined, listingCondition: string | null | undefined): boolean {
  if (!criteriaCondition || criteriaCondition === "all") return true
  return (listingCondition ?? "").trim() === criteriaCondition.trim()
}

function priceMatches(
  listingPrice: number | string | null | undefined,
  minPrice: number | undefined,
  maxPrice: number | undefined,
): boolean {
  const p = typeof listingPrice === "number" ? listingPrice : Number(listingPrice ?? NaN)
  if (!Number.isFinite(p)) return false
  if (minPrice != null && !Number.isNaN(minPrice) && p < minPrice) return false
  if (maxPrice != null && !Number.isNaN(maxPrice) && p > maxPrice) return false
  return true
}

/** Email alerts match nationwide; stored `location` / geo keys in criteria JSON are ignored. */
export function listingMatchesBoardSavedCriteria(
  listing: ListingRowForBoardAlert,
  rawCriteria: unknown,
): boolean {
  const parsed = boardSavedSearchCriteriaSchema.safeParse(rawCriteria)
  if (!parsed.success) return false
  const c = parsed.data

  if (listing.section !== "surfboards") return false
  if (listing.status !== "active") return false
  if (listing.hidden_from_site) return false

  if (!keywordMatchesListing(listing, c.q)) return false

  if (c.brandModelId?.trim()) {
    if ((listing.brand_model_id ?? "").trim() !== c.brandModelId.trim()) return false
  } else if (c.brandId?.trim()) {
    if ((listing.brand_id ?? "").trim() !== c.brandId.trim()) return false
  } else {
    if (!includesInsensitive(listing.brand, c.brand)) return false
    const modelOk =
      !c.model?.trim() ||
      includesInsensitive(listing.model, c.model) ||
      includesInsensitive(listing.title, c.model)
    if (!modelOk) return false
  }

  const hasStructuredDims =
    Boolean(c.dimLength?.trim()) ||
    Boolean(c.dimWidth?.trim()) ||
    Boolean(c.dimThickness?.trim()) ||
    Boolean(c.dimVolume?.trim())
  const dimFields = boardDimensionBrowseFieldsFromSearchParams({
    dimLength: c.dimLength,
    dimWidth: c.dimWidth,
    dimThickness: c.dimThickness,
    dimVolume: c.dimVolume,
    legacyDimensions: hasStructuredDims ? undefined : c.dimensions,
  })
  const dimTokens = boardDimensionBrowseIlikeTokens(dimFields)
  for (const token of dimTokens) {
    if (!includesInsensitive(listing.dimensions, token)) return false
  }

  if (!boardTypeMatches(c.type, listing.board_type)) return false
  if (!conditionMatches(c.condition, listing.condition)) return false
  if (!priceMatches(listing.price, c.minPrice, c.maxPrice)) return false

  return true
}

function listingPublicPath(listing: ListingRowForBoardAlert): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

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
      "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return { attempted: 0, sent: 0, skippedReason: "listing_not_found" }
  }

  const row = listing as ListingRowForBoardAlert

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(service)
  if (searchErr) {
    console.error("[board_saved_search] fetch enabled searches:", searchErr)
    return { attempted: 0, sent: 0, skippedReason: "fetch_searches_failed" }
  }

  let sent = 0
  const eligible = searches.filter((s) => {
    if (s.user_id === row.user_id) return false
    return listingMatchesBoardSavedCriteria(row, s.criteria)
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

  for (const sub of eligible) {
    const claim = await tryInsertBoardSavedSearchAlertSent(service, sub.id, listingId)
    if (claim.error) {
      console.error("[board_saved_search] alert idempotency insert:", claim.error)
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
    })
    sent += 1
  }

  return { attempted: eligible.length, sent }
}
