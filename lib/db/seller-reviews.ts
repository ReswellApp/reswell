import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerReviewSummary = {
  avgRating: number
  reviewCount: number
}

type ReviewSummaryRpcRow = {
  avg_rating: number | string | null
  review_count: number | string | null
}

function parseReviewSummaryRow(row: ReviewSummaryRpcRow | null | undefined): SellerReviewSummary {
  const reviewCount = Number(row?.review_count ?? 0)
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) {
    return { avgRating: 0, reviewCount: 0 }
  }
  const avgRaw = Number(row?.avg_rating ?? 0)
  const avgRating = Number.isFinite(avgRaw) ? Math.round(avgRaw * 10) / 10 : 0
  return { avgRating, reviewCount }
}

function firstRpcRow(data: unknown): ReviewSummaryRpcRow | null {
  if (data == null) return null
  if (Array.isArray(data)) return (data[0] as ReviewSummaryRpcRow | undefined) ?? null
  return data as ReviewSummaryRpcRow
}

/** Fallback when `seller_review_summary` RPC is not deployed yet. */
async function getSellerReviewSummaryLegacy(
  supabase: SupabaseClient,
  reviewedId: string,
): Promise<SellerReviewSummary> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", reviewedId)

  if (error) {
    console.error("[getSellerReviewSummary] legacy fallback:", error.message)
    return { avgRating: 0, reviewCount: 0 }
  }

  const rows = (data ?? []) as { rating: number }[]
  const reviewCount = rows.length
  if (reviewCount === 0) {
    return { avgRating: 0, reviewCount: 0 }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.rating), 0)
  const avgRating = Math.round((total / reviewCount) * 10) / 10
  return { avgRating, reviewCount }
}

/** Seller received-review avg + count via SQL (`seller_review_summary` RPC). */
export async function getSellerReviewSummary(
  supabase: SupabaseClient,
  reviewedId: string,
): Promise<{ data: SellerReviewSummary; error: Error | null }> {
  const { data, error } = await supabase.rpc("seller_review_summary", {
    p_reviewed_id: reviewedId,
  })

  if (error) {
    const legacy = await getSellerReviewSummaryLegacy(supabase, reviewedId)
    return { data: legacy, error: null }
  }

  return { data: parseReviewSummaryRow(firstRpcRow(data)), error: null }
}
