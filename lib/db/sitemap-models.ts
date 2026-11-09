import type { SupabaseClient } from "@supabase/supabase-js"
import { isBoardModelReviewsUnavailable } from "@/lib/board-model-reviews"
import {
  isListingPubliclyVisible,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import {
  modelReviewKey,
  priceGuideRowIsIndexable,
  selectIndexableModelSitemapEntries,
  variantHasIndexableDetail,
  type ModelSitemapCandidate,
  type ModelSitemapSignal,
} from "@/lib/models/model-page-indexable"
import { isPublicCatalogModelName } from "@/lib/brands/public-catalog-model"
import { modelPageSlug } from "@/lib/models/routes"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

export type ModelSitemapEntry = {
  brandSlug: string
  modelSlug: string
}

/** PostgREST returns at most ~1000 rows per request unless ranged. */
const PAGE_SIZE = 1000
const MAX_MODELS = 4000
const MAX_SIGNAL_ROWS = 20_000

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null }

type Paged<T> = { rows: T[]; complete: boolean } | "error"

/**
 * Public `/[brand]/[model]` URLs that have something to rank for.
 * Shells with no listing, sale, spec, price guide, or review stay out of the sitemap
 * and are `noindex` on the page itself.
 */
export async function fetchBrandModelSitemapEntries(
  supabase: SupabaseClient,
): Promise<ModelSitemapEntry[]> {
  const [models, listingModelIds, detailModelIds, priceGuideModelIds, reviewKeys] = await Promise.all([
    fetchModelCandidates(supabase),
    fetchListingModelIds(supabase),
    fetchDetailModelIds(supabase),
    fetchPriceGuideModelIds(supabase),
    fetchReviewKeys(supabase),
  ])

  if (!models) return []

  return selectIndexableModelSitemapEntries(models, {
    listingModelIds,
    detailModelIds,
    priceGuideModelIds,
    reviewKeys,
  })
}

async function fetchPaged<T>(
  label: string,
  load: (from: number, to: number) => Promise<PageResult<T>>,
  maxRows: number,
): Promise<Paged<T>> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`[sitemap] ${label}:`, error.message)
      return "error"
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return { rows, complete: true }
  }
  console.error(`[sitemap] ${label}: stopped after ${maxRows} rows`)
  return { rows, complete: false }
}

async function fetchModelCandidates(
  supabase: SupabaseClient,
): Promise<ModelSitemapCandidate[] | null> {
  const paged = await fetchPaged(
    "brand models",
    (from, to) =>
      supabase
        .from("brand_models")
        .select("id, name, description, brands:brand_id ( slug )")
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    MAX_MODELS,
  )
  if (paged === "error") return null
  if (!paged.complete) {
    console.error(`[sitemap] brand models: catalog exceeded ${MAX_MODELS} rows`)
  }
  const rows = paged.rows

  const out: ModelSitemapCandidate[] = []
  for (const row of rows as {
    id: string | null
    name: string | null
    description: string | null
    brands: { slug: string } | { slug: string }[] | null
  }[]) {
    const joined = row.brands
    const brandSlug = (Array.isArray(joined) ? joined[0]?.slug : joined?.slug)?.trim() ?? ""
    if (!isPublicCatalogModelName(row.name)) continue
    const modelSlug = row.name ? modelPageSlug(row.name) : ""
    const id = row.id?.trim() ?? ""
    if (!id || !brandSlug || !modelSlug) continue
    out.push({ id, brandSlug, modelSlug, description: row.description })
  }
  return out
}

async function fetchListingModelIds(supabase: SupabaseClient): Promise<ModelSitemapSignal> {
  const paged = await fetchPaged(
    "brand model listings",
    (from, to) =>
      supabase
        .from("listings")
        .select("brand_model_id, status, title, hidden_from_site, archived_at")
        .not("brand_model_id", "is", null)
        .in("status", ["active", "sold"])
        .in("section", PEER_LISTING_SECTIONS_FILTER)
        .order("id", { ascending: true })
        .range(from, to),
    MAX_SIGNAL_ROWS,
  )
  if (paged === "error" || !paged.complete) return "unknown"
  const rows = paged.rows

  const ids = new Set<string>()
  for (const row of rows as {
    brand_model_id: string | null
    status: string
    title: string | null
    hidden_from_site: boolean | null
    archived_at: string | null
  }[]) {
    const id = row.brand_model_id?.trim() ?? ""
    if (!id) continue
    const visible =
      row.status === "sold"
        ? isListingVisibleInPublicSoldFeed(row)
        : isListingPubliclyVisible(row)
    if (visible) ids.add(id)
  }
  return ids
}

async function fetchDetailModelIds(supabase: SupabaseClient): Promise<ModelSitemapSignal> {
  const paged = await fetchPaged(
    "brand model variants",
    (from, to) =>
      supabase
        .from("brand_model_variants")
        .select("brand_model_id, length_label, width_label, thickness_label, volume_label, material, fin_boxes")
        .order("id", { ascending: true })
        .range(from, to),
    MAX_SIGNAL_ROWS,
  )
  if (paged === "error" || !paged.complete) return "unknown"
  const rows = paged.rows

  const ids = new Set<string>()
  for (const row of rows as {
    brand_model_id: string | null
    length_label: string | null
    width_label: string | null
    thickness_label: string | null
    volume_label: string | null
    material: string | null
    fin_boxes: string | null
  }[]) {
    const id = row.brand_model_id?.trim() ?? ""
    if (!id || ids.has(id)) continue
    if (variantHasIndexableDetail(row)) ids.add(id)
  }
  return ids
}

async function fetchPriceGuideModelIds(supabase: SupabaseClient): Promise<ModelSitemapSignal> {
  const paged = await fetchPaged(
    "brand model price guide",
    (from, to) =>
      supabase
        .from("price_guide_entries")
        .select("brand_model_id, typical_low_usd, typical_high_usd, headline, summary, body, condition_bands")
        .eq("status", "published")
        .not("brand_model_id", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
    MAX_SIGNAL_ROWS,
  )
  if (paged === "error" || !paged.complete) return "unknown"
  const rows = paged.rows

  const ids = new Set<string>()
  for (const row of rows as {
    brand_model_id: string | null
    typical_low_usd: number | string | null
    typical_high_usd: number | string | null
    headline: string | null
    summary: string | null
    body: string | null
    condition_bands: unknown
  }[]) {
    const id = row.brand_model_id?.trim() ?? ""
    if (!id || !priceGuideRowIsIndexable(row)) continue
    ids.add(id)
  }
  return ids
}

async function fetchReviewKeys(supabase: SupabaseClient): Promise<ModelSitemapSignal> {
  const paged = await fetchPaged(
    "brand model reviews",
    async (from, to) => {
      const result = await supabase
        .from("board_model_reviews")
        .select("brand_slug, model_slug")
        .order("id", { ascending: true })
        .range(from, to)
      if (result.error && isBoardModelReviewsUnavailable(result.error)) {
        return { data: [], error: null }
      }
      return result
    },
    MAX_SIGNAL_ROWS,
  )
  if (paged === "error" || !paged.complete) return "unknown"
  const rows = paged.rows

  const keys = new Set<string>()
  for (const row of rows as { brand_slug: string | null; model_slug: string | null }[]) {
    const brandSlug = row.brand_slug?.trim() ?? ""
    const modelSlug = row.model_slug?.trim() ?? ""
    if (!brandSlug || !modelSlug) continue
    keys.add(modelReviewKey(brandSlug, modelSlug))
  }
  return keys
}
