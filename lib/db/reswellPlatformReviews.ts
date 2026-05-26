import type { SupabaseClient } from "@supabase/supabase-js"

export type ReswellPlatformReviewRow = {
  id: string
  user_id: string
  full_name: string
  description: string
  rating: number
  created_at: string
  updated_at: string
}

export type ReswellPlatformReviewSummary = {
  avgRating: number
  reviewCount: number
}

export async function getReswellPlatformReviewSummary(
  supabase: SupabaseClient,
): Promise<{ data: ReswellPlatformReviewSummary; error: Error | null }> {
  const { data, error } = await supabase.rpc("reswell_platform_review_summary")

  if (error) {
    const legacy = await getReswellPlatformReviewSummaryLegacy(supabase)
    return { data: legacy, error: null }
  }

  const row = Array.isArray(data) ? data[0] : data
  const reviewCount = Number((row as { review_count?: number | string | null } | null)?.review_count ?? 0)
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) {
    return { data: { avgRating: 0, reviewCount: 0 }, error: null }
  }

  const avgRaw = Number((row as { avg_rating?: number | string | null } | null)?.avg_rating ?? 0)
  const avgRating = Number.isFinite(avgRaw) ? Math.round(avgRaw * 10) / 10 : 0

  return { data: { avgRating, reviewCount }, error: null }
}

async function getReswellPlatformReviewSummaryLegacy(
  supabase: SupabaseClient,
): Promise<ReswellPlatformReviewSummary> {
  const { data, error } = await supabase.from("reswell_platform_reviews").select("rating")

  if (error) {
    console.error("[getReswellPlatformReviewSummary] legacy fallback:", error.message)
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

export async function getReswellPlatformReviewByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ReswellPlatformReviewRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("reswell_platform_reviews")
    .select("id, user_id, full_name, description, rating, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: (data as ReswellPlatformReviewRow | null) ?? null, error: null }
}

export async function upsertReswellPlatformReview(
  supabase: SupabaseClient,
  input: {
    user_id: string
    full_name: string
    description: string
    rating: number
  },
): Promise<{ data: ReswellPlatformReviewRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("reswell_platform_reviews")
    .upsert(
      {
        user_id: input.user_id,
        full_name: input.full_name,
        description: input.description,
        rating: input.rating,
      },
      { onConflict: "user_id" },
    )
    .select("id, user_id, full_name, description, rating, created_at, updated_at")
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as ReswellPlatformReviewRow, error: null }
}

export async function getReswellPlatformReviews(
  supabase: SupabaseClient,
): Promise<{ data: ReswellPlatformReviewRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("reswell_platform_reviews")
    .select("id, user_id, full_name, description, rating, created_at, updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    return { data: [], error: new Error(error.message) }
  }

  return { data: (data ?? []) as ReswellPlatformReviewRow[], error: null }
}
