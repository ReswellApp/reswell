import type { SupabaseClient } from "@supabase/supabase-js"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"

export type MarketplaceShowcaseReviewRole = "buyer" | "seller"

export type MarketplaceShowcaseReviewRow = {
  id: string
  rating: number
  comment: string
  created_at: string
  reviewerLabel: string
  reviewerAvatarUrl: string | null
  reviewerProfileHref: string | null
  role: MarketplaceShowcaseReviewRole
  listingId: string | null
  listingSlug: string | null
  listingTitle: string | null
  listingImageSrc: string | null
}

type RawMarketplaceReviewer = {
  display_name: string | null
  avatar_url: string | null
  seller_slug: string | null
  is_shop: boolean | null
  shop_logo_url: string | null
}

type RawMarketplaceListing = {
  id: string
  slug: string | null
  title: string | null
  user_id: string | null
  listing_images: ListingImageForCard[] | ListingImageForCard | null
}

type RawMarketplaceReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_id: string
  reviewer: RawMarketplaceReviewer | RawMarketplaceReviewer[] | null
  listing: RawMarketplaceListing | RawMarketplaceListing[] | null
}

function showcaseReviewerAvatarUrl(reviewer: RawMarketplaceReviewer | null): string | null {
  if (!reviewer) return null
  if (reviewer.is_shop) {
    const shopLogo = reviewer.shop_logo_url?.trim()
    if (shopLogo) return shopLogo
  }
  return reviewer.avatar_url?.trim() || null
}

function pickRel<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

function normalizeListingImages(
  images: ListingImageForCard[] | ListingImageForCard | null | undefined,
): ListingImageForCard[] {
  if (images == null) return []
  return Array.isArray(images) ? images : [images]
}

function toShowcaseReview(row: RawMarketplaceReviewRow): MarketplaceShowcaseReviewRow | null {
  const comment = row.comment?.trim() ?? ""
  if (!comment) return null

  const listing = pickRel(row.listing)
  const listingOwnerId = listing?.user_id
  if (!listingOwnerId) return null

  const role: MarketplaceShowcaseReviewRole =
    row.reviewer_id === listingOwnerId ? "seller" : "buyer"

  const reviewer = pickRel(row.reviewer)
  const reviewerLabel = reviewer?.display_name?.trim() || "Reswell member"
  const reviewerSlug = reviewer?.seller_slug?.trim() || null
  const listingImageSrc = listingCardImageSrc(normalizeListingImages(listing.listing_images)) || null

  return {
    id: row.id,
    rating: row.rating,
    comment,
    created_at: row.created_at,
    reviewerLabel,
    reviewerAvatarUrl: showcaseReviewerAvatarUrl(reviewer),
    reviewerProfileHref: reviewerSlug ? `/sellers/${reviewerSlug}` : null,
    role,
    listingId: listing.id ?? null,
    listingSlug: listing.slug,
    listingTitle: listing.title?.trim() || null,
    listingImageSrc,
  }
}

function sortShowcaseReviews(a: MarketplaceShowcaseReviewRow, b: MarketplaceShowcaseReviewRow): number {
  const aHasImage = a.listingImageSrc ? 1 : 0
  const bHasImage = b.listingImageSrc ? 1 : 0
  if (bHasImage !== aHasImage) return bHasImage - aHasImage
  if (b.rating !== a.rating) return b.rating - a.rating
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export async function getTopMarketplaceShowcaseReviews(
  supabase: SupabaseClient,
  options?: { limitPerRole?: number; minRating?: number },
): Promise<{ data: MarketplaceShowcaseReviewRow[]; error: Error | null }> {
  const limitPerRole = Math.min(Math.max(options?.limitPerRole ?? 4, 1), 8)
  const minRating = options?.minRating ?? 4
  const fetchLimit = limitPerRole * 8

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      reviewer_id,
      reviewer:profiles!reviews_reviewer_id_fkey (
        display_name,
        avatar_url,
        seller_slug,
        is_shop,
        shop_logo_url
      ),
      listing:listings!reviews_listing_id_fkey (
        id,
        slug,
        title,
        user_id,
        listing_images ( url, thumbnail_url, is_primary, sort_order )
      )
    `,
    )
    .not("order_id", "is", null)
    .gte("rating", minRating)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(fetchLimit)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  const buyerReviews: MarketplaceShowcaseReviewRow[] = []
  const sellerReviews: MarketplaceShowcaseReviewRow[] = []

  for (const raw of (data ?? []) as RawMarketplaceReviewRow[]) {
    const review = toShowcaseReview(raw)
    if (!review) continue
    if (review.role === "buyer" && buyerReviews.length < limitPerRole) {
      buyerReviews.push(review)
    } else if (review.role === "seller" && sellerReviews.length < limitPerRole) {
      sellerReviews.push(review)
    }
    if (buyerReviews.length >= limitPerRole && sellerReviews.length >= limitPerRole) break
  }

  buyerReviews.sort(sortShowcaseReviews)
  sellerReviews.sort(sortShowcaseReviews)

  return {
    data: [...buyerReviews, ...sellerReviews].sort(sortShowcaseReviews),
    error: null,
  }
}
