import { cache } from "react"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { getBrandById } from "@/lib/brands/server"
import { getCachedSoldSurfboardUsedShippingFulfillment } from "@/lib/cache/marketplace-sold-feed"
import {
  getCachedReswellPlatformReviewSummary,
  getCachedSellerReviewSummary,
} from "@/lib/cache/review-summaries"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getListingFavoriteCount } from "@/lib/db/listing-favorite-count"
import {
  listSellerReviewPreviews,
  type SellerReviewPreviewRow,
} from "@/lib/db/order-reviews"
import type { ReswellPlatformReviewSummary } from "@/lib/db/reswellPlatformReviews"
import { resolveListingModelPageHref } from "@/lib/services/modelPage"
import { getDb } from "@/lib/supabase/db"

export type SurfboardListingIdentity = {
  brandName: string | null
  brandHref: string | null
  modelPagePath: string | null
}

export type SurfboardListingSocialProof = {
  sellerAvgRating: number
  sellerReviewCount: number
  sellerReviewPreviews: SellerReviewPreviewRow[]
  platformReviewSummary: ReswellPlatformReviewSummary
  cartHolderCount: number
  listingWatchersCount: number
}

const EMPTY_IDENTITY: SurfboardListingIdentity = {
  brandName: null,
  brandHref: null,
  modelPagePath: null,
}

const EMPTY_SOCIAL: SurfboardListingSocialProof = {
  sellerAvgRating: 0,
  sellerReviewCount: 0,
  sellerReviewPreviews: [],
  platformReviewSummary: { avgRating: 0, reviewCount: 0 },
  cartHolderCount: 0,
  listingWatchersCount: 0,
}

/**
 * Brand link and model page href. Cookie-free. Called from Suspense below the
 * gallery so the hero can paint from the listing row alone.
 */
export const loadSurfboardListingIdentity = cache(async function loadSurfboardListingIdentity(
  brandId: string,
  brandModelId: string,
  modelName: string,
): Promise<SurfboardListingIdentity> {
  const trimmedBrandId = brandId.trim()
  if (!trimmedBrandId) return EMPTY_IDENTITY

  try {
    const db = getDb({ consistency: "eventual" })
    const brand = await getBrandById(db, trimmedBrandId)
    if (!brand) return EMPTY_IDENTITY
    const modelPagePath = await resolveListingModelPageHref(db, {
      brand,
      brandModelId,
      modelName,
    })
    const brandName = brand.name.trim() || null
    return {
      brandName,
      brandHref: brand.slug ? `${BRANDS_BASE}/${brand.slug}` : null,
      modelPagePath,
    }
  } catch (error) {
    console.error("[surfboard-pdp] identity extras failed", error)
    return EMPTY_IDENTITY
  }
})

/** Sold-board "this item was shipped" flag. Separate from identity so brand links do not wait on it. */
export const loadSurfboardSoldShipped = cache(async function loadSurfboardSoldShipped(
  listingId: string,
): Promise<boolean> {
  if (!listingId) return false
  try {
    return await getCachedSoldSurfboardUsedShippingFulfillment(listingId)
  } catch (error) {
    console.error("[surfboard-pdp] sold shipping failed", error)
    return false
  }
})

/**
 * Reviews, watcher counts, and the platform rating. Cookie-free anon reads.
 * One in-request cache so each Suspense slot shares a single round trip.
 */
export const loadSurfboardListingSocialProof = cache(async function loadSurfboardListingSocialProof(
  sellerId: string,
  listingId: string,
  isSold: boolean,
): Promise<SurfboardListingSocialProof> {
  const trimmedSellerId = sellerId.trim()
  if (!trimmedSellerId || !listingId) return EMPTY_SOCIAL

  try {
    const eventual = getDb({ consistency: "eventual" })
    const countsDb = getDb({ consistency: "strong" })
    const [sellerReviewSummary, sellerReviewPreviewRes, platformReviewSummary, cartHolderCount, listingWatchersCount] =
      await Promise.all([
        getCachedSellerReviewSummary(trimmedSellerId),
        listSellerReviewPreviews(eventual, trimmedSellerId),
        getCachedReswellPlatformReviewSummary(),
        isSold ? Promise.resolve(0) : getListingCartHolderCount(countsDb, listingId),
        isSold ? Promise.resolve(0) : getListingFavoriteCount(countsDb, listingId),
      ])

    return {
      sellerAvgRating: sellerReviewSummary.avgRating,
      sellerReviewCount: sellerReviewSummary.reviewCount,
      sellerReviewPreviews: sellerReviewPreviewRes.data ?? [],
      platformReviewSummary,
      cartHolderCount,
      listingWatchersCount,
    }
  } catch (error) {
    console.error("[surfboard-pdp] social extras failed", error)
    return EMPTY_SOCIAL
  }
})
