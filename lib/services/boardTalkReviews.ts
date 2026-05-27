import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandRow } from "@/lib/brands/types"
import { getBrandBySlug } from "@/lib/brands/server"
import {
  fetchBrandModelNamesForBrandIds,
  fetchRecentBoardModelReviews,
} from "@/lib/db/board-model-reviews"
import { slugify } from "@/lib/slugify"
import { parseBoardReviewImageAttachment } from "@/lib/validations/board-review-attachment"

export type BoardTalkReviewItem = {
  id: string
  brandSlug: string
  brandName: string
  modelSlug: string
  modelName: string
  rating: number
  comment: string | null
  authorName: string
  createdAt: string
  brandHref: string
  photoFileName: string | null
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export async function getBoardTalkReviewFeed(
  supabase: SupabaseClient,
  limit = 50,
): Promise<BoardTalkReviewItem[]> {
  const rows = await fetchRecentBoardModelReviews(supabase, limit)
  if (rows.length === 0) return []

  const brandSlugs = [...new Set(rows.map((r) => r.brand_slug))]
  const brandBySlug: Record<string, BrandRow> = {}
  await Promise.all(
    brandSlugs.map(async (slug) => {
      const brand = await getBrandBySlug(supabase, slug)
      if (brand) brandBySlug[slug] = brand
    }),
  )

  const brandIds = [...new Set(Object.values(brandBySlug).map((b) => b.id))]
  const modelRows = await fetchBrandModelNamesForBrandIds(supabase, brandIds)

  const modelNameByBrandAndSlug = new Map<string, string>()
  for (const model of modelRows) {
    const brand = Object.values(brandBySlug).find((b) => b.id === model.brand_id)
    if (!brand) continue
    modelNameByBrandAndSlug.set(`${brand.slug}:${slugify(model.name)}`, model.name)
  }

  return rows.map((row) => {
    const brand = brandBySlug[row.brand_slug]
    const brandName = brand?.name ?? titleCaseSlug(row.brand_slug)
    const modelName =
      modelNameByBrandAndSlug.get(`${row.brand_slug}:${row.model_slug}`) ??
      titleCaseSlug(row.model_slug)
    const photoAttachment = parseBoardReviewImageAttachment(row.metadata)

    return {
      id: row.id,
      brandSlug: row.brand_slug,
      brandName,
      modelSlug: row.model_slug,
      modelName,
      rating: row.rating,
      comment: row.comment,
      authorName: row.profiles?.display_name?.trim() || "Member",
      createdAt: row.created_at,
      brandHref: `/brands/${row.brand_slug}`,
      photoFileName: photoAttachment?.file_name ?? null,
    }
  })
}
