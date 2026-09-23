import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { BOARD_ARCHIVE_PAGE_SIZE } from "@/lib/types/board-archive"

const ARCHIVE_SELECT = `
  id,
  listing_id,
  brand_id,
  brand_model_id,
  brand_model_variant_id,
  listing_image_ids,
  created_at,
  listings!board_archive_listing_id_fkey!inner (
    id, title, slug, status, price, dimensions,
    listing_images ( id, url, thumbnail_url, is_primary, sort_order )
  ),
  brands!board_archive_brand_id_fkey!inner ( name ),
  brand_models!board_archive_brand_model_id_fkey!inner ( name ),
  brand_model_variants!board_archive_brand_model_variant_id_fkey ( length_label, width_label, thickness_label, volume_label )
`.trim()

export type BoardArchiveDbVariant = {
  length_label: string | null
  width_label: string | null
  thickness_label: string | null
  volume_label: string | null
}

export type BoardArchiveDbImage = ListingImageForCard & {
  id: string
  sort_order?: number | null
}

export type BoardArchiveDbListing = {
  id: string
  title: string | null
  slug: string | null
  status: string | null
  price: number | string | null
  dimensions: string | null
  listing_images: BoardArchiveDbImage[] | BoardArchiveDbImage | null
}

export type BoardArchiveDbRow = {
  id: string
  listing_id: string
  brand_id: string
  brand_model_id: string
  brand_model_variant_id: string | null
  listing_image_ids: string[] | null
  created_at: string
  listings: BoardArchiveDbListing | BoardArchiveDbListing[] | null
  brands: { name: string | null } | { name: string | null }[] | null
  brand_models: { name: string | null } | { name: string | null }[] | null
  brand_model_variants: BoardArchiveDbVariant | BoardArchiveDbVariant[] | null
}

export type BoardArchiveListResult = {
  rows: BoardArchiveDbRow[]
  total: number
}

function archiveError(scope: string, message: string): Error {
  console.error(`[board-archive] ${scope}:`, message)
  return new Error("Could not load the boards catalog")
}

async function countArchive(
  supabase: SupabaseClient,
  filter?: "variant" | "photo",
): Promise<number> {
  let query = supabase.from("board_archive").select("id", { count: "exact", head: true })
  if (filter === "variant") query = query.not("brand_model_variant_id", "is", null)
  if (filter === "photo") query = query.not("listing_image_ids", "eq", "{}")
  const { count, error } = await query
  if (error) throw archiveError("count", error.message)
  return count ?? 0
}

export async function countBoardArchiveTotals(
  supabase: SupabaseClient,
): Promise<{ catalogTotal: number; withVariant: number; withPhoto: number }> {
  const [catalogTotal, withVariant, withPhoto] = await Promise.all([
    countArchive(supabase),
    countArchive(supabase, "variant"),
    countArchive(supabase, "photo"),
  ])
  return { catalogTotal, withVariant, withPhoto }
}

/** Brand, model, and listing ids whose names match a catalog search. */
export async function findBoardArchiveSearchIds(
  supabase: SupabaseClient,
  query: string,
): Promise<{ brandIds: string[]; modelIds: string[]; listingIds: string[] }> {
  const pattern = `%${query}%`
  const [brands, models, listings] = await Promise.all([
    supabase.from("brands").select("id").ilike("name", pattern).limit(40),
    supabase.from("brand_models").select("id").ilike("name", pattern).limit(40),
    supabase
      .from("listings")
      .select("id")
      .eq("section", "surfboards")
      .ilike("title", pattern)
      .limit(40),
  ])

  if (brands.error) throw archiveError("search brands", brands.error.message)
  if (models.error) throw archiveError("search models", models.error.message)
  if (listings.error) throw archiveError("search listings", listings.error.message)

  return {
    brandIds: (brands.data ?? []).map((row) => row.id as string),
    modelIds: (models.data ?? []).map((row) => row.id as string),
    listingIds: (listings.data ?? []).map((row) => row.id as string),
  }
}

export async function listBoardArchivePage(
  supabase: SupabaseClient,
  input: {
    page: number
    brandIds?: string[]
    modelIds?: string[]
    listingIds?: string[]
    restrictToSearch?: boolean
  },
): Promise<BoardArchiveListResult> {
  const page = Math.max(1, input.page)
  const from = (page - 1) * BOARD_ARCHIVE_PAGE_SIZE
  const to = from + BOARD_ARCHIVE_PAGE_SIZE - 1

  if (input.restrictToSearch) {
    const parts: string[] = []
    if (input.brandIds && input.brandIds.length > 0) {
      parts.push(`brand_id.in.(${input.brandIds.join(",")})`)
    }
    if (input.modelIds && input.modelIds.length > 0) {
      parts.push(`brand_model_id.in.(${input.modelIds.join(",")})`)
    }
    if (input.listingIds && input.listingIds.length > 0) {
      parts.push(`listing_id.in.(${input.listingIds.join(",")})`)
    }
    if (parts.length === 0) return { rows: [], total: 0 }

    const { data, error, count } = await supabase
      .from("board_archive")
      .select(ARCHIVE_SELECT, { count: "exact" })
      .or(parts.join(","))
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) throw archiveError("list", error.message)
    return { rows: (data ?? []) as unknown as BoardArchiveDbRow[], total: count ?? 0 }
  }

  const { data, error, count } = await supabase
    .from("board_archive")
    .select(ARCHIVE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) throw archiveError("list", error.message)
  return { rows: (data ?? []) as unknown as BoardArchiveDbRow[], total: count ?? 0 }
}
