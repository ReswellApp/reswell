import type { BoardModelDetail, BrandProfile, BoardModel } from "@/lib/index-directory/types"
import { getAllBrandSlugs, getBrandProfileBySlug } from "@/lib/index-directory/registry"
import theSolutionDetail from "@/lib/index-directory/data/model-details/channel-islands-surfboards-the-solution.json"

const DETAILS: Record<string, Record<string, BoardModelDetail>> = {
  "channel-islands-surfboards": {
    "the-solution": theSolutionDetail as BoardModelDetail,
  },
}

export function getModelDetail(brandSlug: string, modelSlug: string): BoardModelDetail | null {
  return DETAILS[brandSlug]?.[modelSlug] ?? null
}

export type BrandModelPagePayload = {
  brand: BrandProfile
  model: BoardModel
  detail: BoardModelDetail | null
}

export function getBrandModelPagePayload(
  brandSlug: string,
  modelSlug: string,
): BrandModelPagePayload | null {
  const brand = getBrandProfileBySlug(brandSlug)
  if (!brand) return null
  const model = brand.models.find((m) => m.slug === modelSlug)
  if (!model) return null
  return {
    brand,
    model,
    detail: getModelDetail(brandSlug, modelSlug),
  }
}

export function getAllBrandModelStaticParams(): { slug: string; modelSlug: string }[] {
  const out: { slug: string; modelSlug: string }[] = []
  for (const slug of getAllBrandSlugs()) {
    const b = getBrandProfileBySlug(slug)
    if (!b) continue
    for (const m of b.models) {
      out.push({ slug, modelSlug: m.slug })
    }
  }
  return out
}
