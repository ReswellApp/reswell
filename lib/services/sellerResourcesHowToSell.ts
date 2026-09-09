import type { SupabaseClient } from "@supabase/supabase-js"
import { getSellerReviewSummary } from "@/lib/db/seller-reviews"
import { listSellerReviewPreviews, type SellerReviewPreviewRow } from "@/lib/db/order-reviews"
import {
  howToSellListingImagesForCard,
  listHowToSellShopProfiles,
  listHowToSellSoldSurfboardExamples,
  type HowToSellShopProfileRow,
} from "@/lib/db/seller-resources-how-to-sell"
import { listingDetailHref } from "@/lib/listing-href"
import {
  coalesceListingImagesForCard,
  listingTileCarouselImageUrls,
} from "@/lib/listing-image-display"
import { sellerProfileHref } from "@/lib/seller-slug"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import {
  resolveMetaCatalogHaydenShopUserId,
  resolveMetaCatalogOutSurfingShopUserId,
} from "@/lib/services/metaCatalogFeed"
import type {
  HowToSellGuidePayload,
  HowToSellPhotoExample,
  HowToSellReviewPreview,
  HowToSellShopSpotlight,
} from "@/lib/types/seller-resources-how-to-sell"

const PHOTO_EXAMPLE_LIMIT = 12
const PHOTO_EXAMPLE_MIN_IMAGES = 1
const REVIEWS_PER_SHOP = 3

function trimText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed.length > 0 ? trimmed : null
}

function shopLabel(profile: HowToSellShopProfileRow): string {
  return trimText(profile.shop_name) || trimText(profile.display_name) || "Seller"
}

function shopLocation(profile: HowToSellShopProfileRow): string | null {
  return trimText(profile.shop_address) || trimText(profile.city) || trimText(profile.location)
}

function reviewerName(review: SellerReviewPreviewRow): string {
  const embed = review.reviewer
  const row = Array.isArray(embed) ? embed[0] : embed
  return trimText(row?.display_name) || "Verified buyer"
}

function reviewDateLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function mapReviews(rows: SellerReviewPreviewRow[]): HowToSellReviewPreview[] {
  const withComments: HowToSellReviewPreview[] = []
  for (const row of rows) {
    const comment = trimText(row.comment)
    if (!comment) continue
    withComments.push({
      id: row.id,
      rating: row.rating,
      comment,
      reviewerName: reviewerName(row),
      createdAtLabel: reviewDateLabel(row.created_at),
    })
    if (withComments.length >= REVIEWS_PER_SHOP) break
  }
  return withComments
}

function mapPhotoExamples(rows: Awaited<ReturnType<typeof listHowToSellSoldSurfboardExamples>>): HowToSellPhotoExample[] {
  const candidates = rows
    .map((row) => {
      const listingImages = coalesceListingImagesForCard({
        listing_images: howToSellListingImagesForCard(row.listing_images),
        primary_image_url: row.primary_image_url,
        primary_thumbnail_url: row.primary_thumbnail_url,
      }) ?? []
      const images = listingTileCarouselImageUrls(listingImages)
      return {
        listingId: row.id,
        href: listingDetailHref(row),
        title: row.title.trim() || "Sold surfboard",
        condition: trimText(row.condition),
        images,
        listingImages,
      }
    })
    .filter((row) => row.images.length >= PHOTO_EXAMPLE_MIN_IMAGES)

  candidates.sort((a, b) => b.images.length - a.images.length)
  return candidates.slice(0, PHOTO_EXAMPLE_LIMIT)
}

async function buildShopSpotlight(
  supabase: SupabaseClient,
  profile: HowToSellShopProfileRow,
): Promise<HowToSellShopSpotlight> {
  const [{ data: summary }, { data: previews }] = await Promise.all([
    getSellerReviewSummary(supabase, profile.id),
    listSellerReviewPreviews(supabase, profile.id, 8),
  ])

  return {
    id: profile.id,
    name: shopLabel(profile),
    href: sellerProfileHref(profile),
    avatarSrc: resolveSellerProfileDisplayImageUrl(profile),
    location: shopLocation(profile),
    verified: Boolean(profile.shop_verified),
    salesCount: Math.max(0, Number(profile.sales_count ?? 0) || 0),
    avgRating: summary.avgRating,
    reviewCount: summary.reviewCount,
    reviews: mapReviews(previews),
  }
}

export async function getHowToSellGuidePayload(
  supabase: SupabaseClient,
): Promise<HowToSellGuidePayload> {
  const [haydenId, outSurfingId] = await Promise.all([
    resolveMetaCatalogHaydenShopUserId(supabase),
    resolveMetaCatalogOutSurfingShopUserId(supabase),
  ])

  const sellerIds = [haydenId, outSurfingId].filter((id): id is string => Boolean(id))
  if (sellerIds.length === 0) {
    return { photoExamples: [], shops: [] }
  }

  const [profiles, soldRows] = await Promise.all([
    listHowToSellShopProfiles(supabase, sellerIds),
    haydenId
      ? listHowToSellSoldSurfboardExamples(supabase, haydenId)
      : Promise.resolve([]),
  ])

  const profileById = new Map(profiles.map((row) => [row.id, row]))
  const orderedProfiles = sellerIds
    .map((id) => profileById.get(id))
    .filter((row): row is HowToSellShopProfileRow => row != null)

  const shops = await Promise.all(
    orderedProfiles.map((profile) => buildShopSpotlight(supabase, profile)),
  )

  return {
    photoExamples: mapPhotoExamples(soldRows),
    shops,
  }
}
