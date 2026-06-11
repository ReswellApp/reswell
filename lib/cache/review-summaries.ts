import { cache } from "react"
import { unstable_cache } from "next/cache"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { getSellerReviewSummary, type SellerReviewSummary } from "@/lib/db/seller-reviews"
import {
  getReswellPlatformReviewSummary,
  type ReswellPlatformReviewSummary,
} from "@/lib/db/reswellPlatformReviews"

/**
 * Non-personalized review aggregates rendered on every PDP view.
 * Reviews are public data (visible to anonymous visitors), so these run on the
 * anon client and tolerate a few minutes of staleness.
 */
export const REVIEW_SUMMARY_CACHE_TAG = "review-summaries"
export const REVIEW_SUMMARY_REVALIDATE_SECONDS = 60 * 5

const getCachedReswellPlatformReviewSummaryRow = unstable_cache(
  async (): Promise<ReswellPlatformReviewSummary> => {
    const supabase = createAnonSupabaseClient()
    const { data } = await getReswellPlatformReviewSummary(supabase)
    return data
  },
  ["reswell-platform-review-summary"],
  {
    revalidate: REVIEW_SUMMARY_REVALIDATE_SECONDS,
    tags: [REVIEW_SUMMARY_CACHE_TAG],
  },
)

const getCachedSellerReviewSummaryRow = unstable_cache(
  async (sellerId: string): Promise<SellerReviewSummary> => {
    const supabase = createAnonSupabaseClient()
    const { data } = await getSellerReviewSummary(supabase, sellerId)
    return data
  },
  ["seller-review-summary"],
  {
    revalidate: REVIEW_SUMMARY_REVALIDATE_SECONDS,
    tags: [REVIEW_SUMMARY_CACHE_TAG],
  },
)

/** Per-request dedupe on top of the shared cache. */
export const getCachedReswellPlatformReviewSummary = cache(async () => {
  return getCachedReswellPlatformReviewSummaryRow()
})

export const getCachedSellerReviewSummary = cache(async (sellerId: string) => {
  return getCachedSellerReviewSummaryRow(sellerId)
})
