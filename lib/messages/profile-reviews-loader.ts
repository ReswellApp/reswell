import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Direction of a review relative to the *reviewed* user, derived from the
 * order's listing owner: if the reviewed user owned the listing they were
 * the seller (review is "as_seller"); otherwise they were the buyer.
 */
export type ProfileReviewDirection = "as_seller" | "as_buyer"

export interface ProfileReviewerSummary {
  id: string | null
  display_name: string | null
  avatar_url: string | null
}

export interface ProfileReviewItem {
  id: string
  rating: number
  comment: string | null
  created_at: string
  direction: ProfileReviewDirection
  reviewer: ProfileReviewerSummary | null
}

export interface ProfileReviewSummary {
  count: number
  avg: number
  asSellerCount: number
  asBuyerCount: number
}

export interface OtherPartyProfileSummary {
  userId: string
  sellerSlug: string | null
  hasListings: boolean
  summary: ProfileReviewSummary
  recentReviews: ProfileReviewItem[]
}

const REVIEW_SELECT =
  "id, rating, comment, created_at, reviewed_id, reviewer:profiles!reviews_reviewer_id_fkey(id, display_name, avatar_url), listing:listings!reviews_listing_id_fkey(user_id)"

interface RawReviewRow {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewed_id: string
  reviewer:
    | { id: string | null; display_name: string | null; avatar_url: string | null }
    | { id: string | null; display_name: string | null; avatar_url: string | null }[]
    | null
  listing:
    | { user_id: string | null }
    | { user_id: string | null }[]
    | null
}

function pickFirst<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

/**
 * Normalize a raw review row into a directional `ProfileReviewItem`.
 * Direction is derived from the listing owner: if the reviewed user owns
 * the listing, they were the seller; otherwise they were the buyer.
 */
export function normalizeReviewRow(
  row: RawReviewRow,
): ProfileReviewItem {
  const reviewer = pickFirst(row.reviewer)
  const listing = pickFirst(row.listing)
  const direction: ProfileReviewDirection =
    listing?.user_id && listing.user_id === row.reviewed_id ? "as_seller" : "as_buyer"
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    direction,
    reviewer: reviewer
      ? {
          id: reviewer.id,
          display_name: reviewer.display_name,
          avatar_url: reviewer.avatar_url,
        }
      : null,
  }
}

function summarizeReviews(items: ProfileReviewItem[]): ProfileReviewSummary {
  if (items.length === 0) {
    return { count: 0, avg: 0, asSellerCount: 0, asBuyerCount: 0 }
  }
  let total = 0
  let asSellerCount = 0
  let asBuyerCount = 0
  for (const r of items) {
    total += r.rating
    if (r.direction === "as_seller") asSellerCount += 1
    else asBuyerCount += 1
  }
  return {
    count: items.length,
    avg: total / items.length,
    asSellerCount,
    asBuyerCount,
  }
}

/**
 * Fetches the public profile snapshot we render in the messages thread header
 * for the other conversation party: seller_slug, whether they have any
 * listings (have they "become a seller"?), and their received-review feed.
 */
export async function loadOtherPartyProfile(
  supabase: SupabaseClient,
  userId: string,
  opts: { recentLimit?: number } = {},
): Promise<OtherPartyProfileSummary> {
  const recentLimit = Math.max(1, opts.recentLimit ?? 12)

  const [profileRes, listingProbeRes, reviewsRes] = await Promise.all([
    supabase.from("profiles").select("seller_slug").eq("id", userId).maybeSingle(),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .limit(1),
    supabase
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("reviewed_id", userId)
      .order("created_at", { ascending: false }),
  ])

  const sellerSlug =
    (profileRes.data as { seller_slug: string | null } | null)?.seller_slug ?? null
  const hasListings = (listingProbeRes.count ?? 0) > 0

  const allRows = (reviewsRes.data ?? []) as RawReviewRow[]
  const allItems = allRows.map(normalizeReviewRow)
  const summary = summarizeReviews(allItems)
  const recentReviews = allItems.slice(0, recentLimit)

  return {
    userId,
    sellerSlug,
    hasListings,
    summary,
    recentReviews,
  }
}
