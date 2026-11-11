import type { SupabaseClient } from "@supabase/supabase-js"

import {
  coalesceListingImagesForCard,
  listingTitleThumbnailSrc,
} from "@/lib/listing-image-display"
import { isPublicCatalogModelName } from "@/lib/brands/public-catalog-model"

export type BoardMatchListingRow = {
  listingId: string
  listingSlug: string | null
  brandId: string
  brandModelId: string
  imageUrl: string
}

export type BoardMatchBrandRef = {
  id: string
  name: string
  slug: string
}

export type BoardMatchModelRef = {
  id: string
  brandId: string
  name: string
}

type ListingCandidateRow = {
  id: string
  slug: string | null
  brand_id: string | null
  brand_model_id: string | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  tile_gallery_images?: unknown
  hidden_from_site?: boolean | null
  archived_at?: string | null
}

const LISTING_CANDIDATE_SELECT =
  "id, slug, brand_id, brand_model_id, primary_image_url, primary_thumbnail_url, tile_gallery_images, hidden_from_site, archived_at"

/**
 * Recent surfboard listings that are linked to a catalog brand + model and have
 * a marketplace photo. Catalog manufacturer scrapes are never used.
 */
export async function listBoardMatchListingCandidates(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<BoardMatchListingRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 120, 1), 200)

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_CANDIDATE_SELECT)
    .eq("section", "surfboards")
    .in("status", ["active", "sold"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .not("brand_id", "is", null)
    .not("brand_model_id", "is", null)
    .not("primary_image_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[listBoardMatchListingCandidates]", error.message)
    return []
  }

  const out: BoardMatchListingRow[] = []
  const seenModels = new Set<string>()

  for (const row of (data ?? []) as ListingCandidateRow[]) {
    const brandId = row.brand_id?.trim() ?? ""
    const brandModelId = row.brand_model_id?.trim() ?? ""
    if (!brandId || !brandModelId) continue
    if (seenModels.has(brandModelId)) continue

    const images = coalesceListingImagesForCard(row)
    const imageUrl = listingTitleThumbnailSrc(images).trim()
    if (!imageUrl) continue

    seenModels.add(brandModelId)
    out.push({
      listingId: row.id,
      listingSlug: row.slug?.trim() || null,
      brandId,
      brandModelId,
      imageUrl,
    })
  }

  return out
}

export async function listBoardMatchBrandsByIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<Map<string, BoardMatchBrandRef>> {
  const ids = [...new Set(brandIds.map((id) => id.trim()).filter(Boolean))]
  const out = new Map<string, BoardMatchBrandRef>()
  if (ids.length === 0) return out

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug")
    .in("id", ids)

  if (error) {
    console.error("[listBoardMatchBrandsByIds]", error.message)
    return out
  }

  for (const row of data ?? []) {
    const id = typeof row.id === "string" ? row.id : ""
    const name = typeof row.name === "string" ? row.name.trim() : ""
    const slug = typeof row.slug === "string" ? row.slug.trim() : ""
    if (!id || !name || !slug) continue
    out.set(id, { id, name, slug })
  }

  return out
}

export async function listBoardMatchModelsByIds(
  supabase: SupabaseClient,
  modelIds: readonly string[],
): Promise<Map<string, BoardMatchModelRef>> {
  const ids = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))]
  const out = new Map<string, BoardMatchModelRef>()
  if (ids.length === 0) return out

  const { data, error } = await supabase
    .from("brand_models")
    .select("id, brand_id, name")
    .in("id", ids)
    .eq("product_category_slug", "surfboards")

  if (error) {
    console.error("[listBoardMatchModelsByIds]", error.message)
    return out
  }

  for (const row of data ?? []) {
    const id = typeof row.id === "string" ? row.id : ""
    const brandId = typeof row.brand_id === "string" ? row.brand_id : ""
    const name = typeof row.name === "string" ? row.name.trim() : ""
    if (!id || !brandId || !name) continue
    if (!isPublicCatalogModelName(name)) continue
    out.set(id, { id, brandId, name })
  }

  return out
}

/** Sibling surfboard models for distractor model-name choices. */
export async function listBoardMatchModelsForBrandIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<Map<string, BoardMatchModelRef[]>> {
  const ids = [...new Set(brandIds.map((id) => id.trim()).filter(Boolean))]
  const out = new Map<string, BoardMatchModelRef[]>()
  if (ids.length === 0) return out

  const { data, error } = await supabase
    .from("brand_models")
    .select("id, brand_id, name")
    .in("brand_id", ids)
    .eq("product_category_slug", "surfboards")
    .order("name", { ascending: true })
    .limit(800)

  if (error) {
    console.error("[listBoardMatchModelsForBrandIds]", error.message)
    return out
  }

  for (const row of data ?? []) {
    const id = typeof row.id === "string" ? row.id : ""
    const brandId = typeof row.brand_id === "string" ? row.brand_id : ""
    const name = typeof row.name === "string" ? row.name.trim() : ""
    if (!id || !brandId || !name) continue
    if (!isPublicCatalogModelName(name)) continue
    const list = out.get(brandId) ?? []
    list.push({ id, brandId, name })
    out.set(brandId, list)
  }

  return out
}
