import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  coalesceListingImagesForCard,
  listingCoverImageForCard,
} from "@/lib/listing-image-display"
import { brandTextAliasesForSearch } from "@/lib/utils/marketplace-brand-synonyms"
import { brandLegacyRecallTokens } from "@/lib/utils/marketplace-brand-query"
import { fetchRecentlySoldListingsConfirmedCheckoutOrdering } from "@/lib/db/home-recently-sold-strip"
import { isPeerListingSection, PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { isListingVisibleInPublicSoldFeed } from "@/lib/listing-public-visibility"
import {
  canUseModelTextFallback,
  listingBelongsToCatalogModel,
} from "@/lib/models/match"

const BRAND_MARKETPLACE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  is_good_deal,
  condition,
  section,
  status,
  city,
  state,
  shipping_available,
  local_pickup,
  board_type,
  dimensions,
  created_at,
  updated_at,
  hidden_from_site,
  archived_at,
  primary_image_url,
  primary_thumbnail_url,
  tile_gallery_images,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name, slug)
`

function escapeForOrFilter(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Directory brand_id, official brand text, synonym aliases (Lost ↔ Mayhem), and
 * last-name / legacy title tokens ("Christenson" for "Chris Christenson").
 */
function brandInventoryOrClause(brand: { id: string; name: string }): string {
  const namePattern = `"%${escapeForOrFilter(brand.name)}%"`
  const clauses = [`brand_id.eq.${brand.id}`, `brand.ilike.${namePattern}`]
  const seen = new Set<string>(clauses)

  const addIlike = (field: "brand" | "title" | "model", token: string) => {
    if (token.length < 4) return
    const clause = `${field}.ilike."%${escapeForOrFilter(token)}%"`
    if (seen.has(clause)) return
    seen.add(clause)
    clauses.push(clause)
  }

  for (const alias of brandTextAliasesForSearch(brand.name)) {
    addIlike("brand", alias)
    addIlike("title", alias)
  }

  const fullNameLower = brand.name.trim().toLowerCase()
  for (const token of brandLegacyRecallTokens(brand.name)) {
    if (token !== fullNameLower) addIlike("brand", token)
    addIlike("title", token)
    addIlike("model", token)
  }

  return clauses.join(",")
}

const LISTING_ID_IN_BATCH = 150

/** Keep `listingIds` that match a directory brand, preserving input order. */
export async function filterListingIdsMatchingBrand(
  supabase: SupabaseClient,
  listingIds: readonly string[],
  brand: { id: string; name: string },
): Promise<string[]> {
  const unique = [...new Set(listingIds.filter((id) => id.length > 0))]
  if (unique.length === 0) return []

  const matched = new Set<string>()
  const clause = brandInventoryOrClause(brand)

  for (let i = 0; i < unique.length; i += LISTING_ID_IN_BATCH) {
    const batch = unique.slice(i, i + LISTING_ID_IN_BATCH)
    const { data, error } = await supabase.from("listings").select("id").in("id", batch).or(clause)
    if (error) {
      console.error("[filterListingIdsMatchingBrand]", error.message)
      return []
    }
    for (const row of data ?? []) {
      if (typeof row.id === "string" && row.id) matched.add(row.id)
    }
  }

  return listingIds.filter((id) => matched.has(id))
}

interface BrandMarketplaceListingRow {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | string | null
  is_good_deal?: boolean | null
  condition: string
  section: string
  status?: string
  hidden_from_site?: boolean | null
  archived_at?: string | null
  city?: string | null
  state?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  board_type?: string | null
  dimensions?: string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  model?: string | null
  brand_model_id?: string | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  tile_gallery_images?: unknown
  listing_images?: RecentListing["listing_images"]
  profiles?: RecentListing["profiles"] & { seller_slug?: string | null }
  categories?: RecentListing["categories"]
}

function mapRowToRecentListing(row: BrandMarketplaceListingRow): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(row.dimensions) ?? null
  return {
    id: row.id,
    slug: row.slug ?? null,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    compare_at_price: row.compare_at_price ?? null,
    is_good_deal: row.is_good_deal,
    condition: row.condition,
    section: row.section,
    status: row.status,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available ?? undefined,
    local_pickup: row.local_pickup,
    board_type: row.board_type,
    board_length: boardLength,
    updated_at: row.updated_at ?? null,
    listing_images: listingCoverImageForCard(coalesceListingImagesForCard(row)),
    profiles: row.profiles,
    categories: row.categories,
  }
}

const BRAND_ID_IN_CHUNK = 80
const LISTING_BRAND_ID_PAGE = 1000

/**
 * Active peer-marketplace listing counts keyed by directory `brands.id`.
 * Counts rows with `listings.brand_id` set (same discovery gates as brand inventory lists).
 */
export async function countActiveListingsByBrandIds(
  supabase: SupabaseClient,
  brandIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const id of brandIds) counts.set(id, 0)
  if (brandIds.length === 0) return counts

  for (let i = 0; i < brandIds.length; i += BRAND_ID_IN_CHUNK) {
    const chunk = brandIds.slice(i, i + BRAND_ID_IN_CHUNK)
    let from = 0

    for (;;) {
      const { data, error } = await supabase
        .from("listings")
        .select("brand_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .in("section", PEER_LISTING_SECTIONS_FILTER)
        .in("brand_id", chunk)
        .range(from, from + LISTING_BRAND_ID_PAGE - 1)

      if (error) {
        console.error("[countActiveListingsByBrandIds]", error.message)
        break
      }

      const rows = (data ?? []) as { brand_id: string | null }[]
      for (const row of rows) {
        if (!row.brand_id) continue
        counts.set(row.brand_id, (counts.get(row.brand_id) ?? 0) + 1)
      }

      if (rows.length < LISTING_BRAND_ID_PAGE) break
      from += LISTING_BRAND_ID_PAGE
    }
  }

  return counts
}

/**
 * Active marketplace listings linked to a directory brand (`brand_id`), official
 * brand text, synonym aliases, or last-name / legacy title text.
 * Matches `/search?brandSlug=` surfboard results (optional category filter).
 */
export async function listActiveListingsForBrand(
  supabase: SupabaseClient,
  brand: { id: string; name: string },
  options: { limit: number; categoryId?: string | null; sections?: string[] },
): Promise<RecentListing[]> {
  const { limit, categoryId = null, sections } = options

  let q = supabase
    .from("listings")
    .select(BRAND_MARKETPLACE_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else if (sections?.length) {
    q = q.in("section", sections)
  } else {
    /** Peer marketplace only — Reswell retail lives solely on `/reswell/shop`. */
    q = q.in("section", PEER_LISTING_SECTIONS_FILTER)
  }

  q = q.or(brandInventoryOrClause(brand))
  q = q.order("created_at", { ascending: false }).limit(limit)

  const { data, error } = await q
  if (error) {
    console.error("[listActiveListingsForBrand]", error.message)
    return []
  }
  if (!data?.length) return []
  return (data as BrandMarketplaceListingRow[]).map(mapRowToRecentListing)
}

/**
 * Sold peer marketplace listings for a directory brand.
 * Reswell retail (`section = new`) is excluded — it lives only on `/reswell/shop`.
 */
export async function listRecentlySoldListingsForBrand(
  supabase: SupabaseClient,
  brand: { id: string; name: string },
  options: { limit: number; categoryId?: string | null },
): Promise<RecentListing[]> {
  const { limit, categoryId = null } = options

  const { orderedListingIds, confirmedAtIsoByListingId } =
    await fetchRecentlySoldListingsConfirmedCheckoutOrdering(
      supabase,
      120,
      PEER_LISTING_SECTIONS_FILTER,
    )

  let q = supabase
    .from("listings")
    .select(BRAND_MARKETPLACE_LISTING_SELECT)
    .eq("status", "sold")

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else {
    q = q.in("section", PEER_LISTING_SECTIONS_FILTER)
  }

  q = q.or(brandInventoryOrClause(brand))
  q = q.order("updated_at", { ascending: false }).limit(Math.min(limit * 4, 120))

  const { data, error } = await q
  if (error) {
    console.error("[listRecentlySoldListingsForBrand]", error.message)
    return []
  }
  if (!data?.length) return []

  const rows = (data as BrandMarketplaceListingRow[]).filter((row) =>
    isListingVisibleInPublicSoldFeed(row),
  )

  const peerRowsById = new Map(
    rows
      .filter((row) => isPeerListingSection(row.section))
      .map((row) => [row.id, row]),
  )

  const ordered: RecentListing[] = []

  for (const id of orderedListingIds) {
    const row = peerRowsById.get(id)
    if (!row) continue
    const mapped = mapRowToRecentListing(row)
    const confirmedAt = confirmedAtIsoByListingId.get(id)
    ordered.push(confirmedAt ? { ...mapped, updated_at: confirmedAt } : mapped)
    if (ordered.length >= limit) return ordered
  }

  for (const row of rows) {
    if (ordered.some((item) => item.id === row.id)) continue
    if (!isPeerListingSection(row.section)) continue
    ordered.push(mapRowToRecentListing(row))
    if (ordered.length >= limit) return ordered
  }

  return ordered
}

/**
 * Active listing ids linked to catalog models — same recall path nav typeahead
 * uses when Elasticsearch over-constrains a shared model prefix.
 */
export type ModelMarketplaceListing = RecentListing & {
  description: string | null
  created_at: string | null
  photo_count: number
  shop_verified: boolean
  profiles?: RecentListing["profiles"] & { seller_slug?: string | null }
}

const MODEL_MARKETPLACE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  is_good_deal,
  condition,
  section,
  status,
  city,
  state,
  shipping_available,
  local_pickup,
  board_type,
  dimensions,
  description,
  created_at,
  updated_at,
  hidden_from_site,
  archived_at,
  model,
  brand_model_id,
  primary_image_url,
  primary_thumbnail_url,
  tile_gallery_images,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified, seller_slug),
  categories (name, slug)
`

function photoCountFromRow(row: BrandMarketplaceListingRow): number {
  if (Array.isArray(row.listing_images) && row.listing_images.length > 0) {
    return row.listing_images.length
  }
  if (Array.isArray(row.tile_gallery_images)) return row.tile_gallery_images.length
  return row.primary_image_url ? 1 : 0
}

function mapRowToModelListing(row: BrandMarketplaceListingRow & {
  description?: string | null
  created_at?: string | null
}): ModelMarketplaceListing {
  const mapped = mapRowToRecentListing(row)
  const shopVerified = Boolean(row.profiles?.shop_verified)
  return {
    ...mapped,
    description: row.description?.trim() || null,
    created_at: row.created_at ?? null,
    photo_count: photoCountFromRow(row),
    shop_verified: shopVerified,
    profiles: row.profiles,
  }
}

export type BrandModelListingQuery = {
  brand: { id: string; name: string }
  model: { id: string; name: string }
  siblingModels?: readonly { id: string; name: string }[]
  limit?: number
}

type ModelListingRow = BrandMarketplaceListingRow & {
  description?: string | null
  created_at?: string | null
}

function modelNameOrClause(modelName: string): string {
  const pattern = `"%${escapeForOrFilter(modelName)}%"`
  return `title.ilike.${pattern},model.ilike.${pattern}`
}

function rowBelongsToModel(
  row: ModelListingRow,
  input: BrandModelListingQuery,
): boolean {
  return listingBelongsToCatalogModel(
    {
      title: row.title,
      model: row.model,
      brand_model_id: row.brand_model_id,
    },
    input.model,
    input.siblingModels ?? [],
  )
}

async function listListingsForBrandModel(
  supabase: SupabaseClient,
  input: BrandModelListingQuery,
  options: { status: "active" | "sold"; logLabel: string },
): Promise<ModelListingRow[]> {
  const limit = input.limit ?? 48
  const orderColumn = options.status === "active" ? "created_at" : "updated_at"

  let byId = supabase
    .from("listings")
    .select(MODEL_MARKETPLACE_LISTING_SELECT)
    .eq("status", options.status)
    .eq("brand_model_id", input.model.id)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .order(orderColumn, { ascending: false })
    .limit(limit)

  if (options.status === "active") {
    byId = byId.eq("hidden_from_site", false)
  }

  const byIdResult = await byId
  if (byIdResult.error) {
    console.error(`[${options.logLabel}] id:`, byIdResult.error.message)
  }

  const matched = new Map<string, ModelListingRow>()
  for (const row of (byIdResult.data ?? []) as ModelListingRow[]) {
    if (options.status === "sold" && !isListingVisibleInPublicSoldFeed(row)) continue
    matched.set(row.id, row)
  }

  if (matched.size >= limit || !canUseModelTextFallback(input.model.name)) {
    return [...matched.values()].slice(0, limit)
  }

  const recallLimit = Math.min(limit * 4, 160)

  let brandQ = supabase
    .from("listings")
    .select(MODEL_MARKETPLACE_LISTING_SELECT)
    .eq("status", options.status)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .or(brandInventoryOrClause(input.brand))
    .order(orderColumn, { ascending: false })
    .limit(recallLimit)

  let namedQ = supabase
    .from("listings")
    .select(MODEL_MARKETPLACE_LISTING_SELECT)
    .eq("status", options.status)
    .eq("brand_id", input.brand.id)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .or(modelNameOrClause(input.model.name))
    .order(orderColumn, { ascending: false })
    .limit(recallLimit)

  if (options.status === "active") {
    brandQ = brandQ.eq("hidden_from_site", false)
    namedQ = namedQ.eq("hidden_from_site", false)
  }

  const [brandResult, namedResult] = await Promise.all([brandQ, namedQ])
  if (brandResult.error) {
    console.error(`[${options.logLabel}] brand:`, brandResult.error.message)
  }
  if (namedResult.error) {
    console.error(`[${options.logLabel}] named:`, namedResult.error.message)
  }

  const recallRows = [
    ...((brandResult.data ?? []) as ModelListingRow[]),
    ...((namedResult.data ?? []) as ModelListingRow[]),
  ]

  for (const row of recallRows) {
    if (matched.has(row.id)) continue
    if (options.status === "sold" && !isListingVisibleInPublicSoldFeed(row)) continue
    if (!rowBelongsToModel(row, input)) continue
    matched.set(row.id, row)
    if (matched.size >= limit) break
  }

  return [...matched.values()]
}

/**
 * Active listings for a catalog model: exact `brand_model_id`, plus a title/model
 * text fallback so untagged Lane Splitter-style listings still appear.
 */
export async function listActiveListingsForBrandModel(
  supabase: SupabaseClient,
  input: BrandModelListingQuery,
): Promise<ModelMarketplaceListing[]> {
  const rows = await listListingsForBrandModel(supabase, input, {
    status: "active",
    logLabel: "listActiveListingsForBrandModel",
  })
  return rows.map(mapRowToModelListing)
}

/**
 * Public sold history for a catalog model — tagged rows plus title/model recall
 * so past listings that never received `brand_model_id` still appear.
 */
export async function listModelMarketplaceListingsByIds(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<ModelMarketplaceListing[]> {
  const ids = [...new Set(listingIds.filter((id) => id.length > 0))]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(MODEL_MARKETPLACE_LISTING_SELECT)
    .in("id", ids)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

  if (error) {
    console.error("[listModelMarketplaceListingsByIds]", error.message)
    return []
  }

  const byId = new Map(
    ((data ?? []) as ModelListingRow[])
      .filter((row) => row.status !== "sold" || isListingVisibleInPublicSoldFeed(row))
      .map((row) => [row.id, mapRowToModelListing(row)]),
  )
  return ids.flatMap((id) => {
    const listing = byId.get(id)
    return listing ? [listing] : []
  })
}

export async function listSoldListingsForBrandModel(
  supabase: SupabaseClient,
  input: BrandModelListingQuery,
): Promise<ModelMarketplaceListing[]> {
  const limit = input.limit ?? 48
  const rows = await listListingsForBrandModel(supabase, input, {
    status: "sold",
    logLabel: "listSoldListingsForBrandModel",
  })
  if (rows.length === 0) return []

  const { orderedListingIds, confirmedAtIsoByListingId } =
    await fetchRecentlySoldListingsConfirmedCheckoutOrdering(
      supabase,
      120,
      PEER_LISTING_SECTIONS_FILTER,
    )

  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered: ModelMarketplaceListing[] = []

  for (const id of orderedListingIds) {
    const row = byId.get(id)
    if (!row) continue
    const mapped = mapRowToModelListing(row)
    const confirmedAt = confirmedAtIsoByListingId.get(id)
    ordered.push(confirmedAt ? { ...mapped, updated_at: confirmedAt } : mapped)
    if (ordered.length >= limit) return ordered
  }

  for (const row of rows) {
    if (ordered.some((item) => item.id === row.id)) continue
    ordered.push(mapRowToModelListing(row))
    if (ordered.length >= limit) return ordered
  }

  return ordered
}

export async function listActiveListingIdsByBrandModelIds(
  supabase: SupabaseClient,
  modelIds: string[],
  options: { limit: number; sections?: string[] },
): Promise<string[]> {
  const ids = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []

  let q = supabase
    .from("listings")
    .select("id")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("brand_model_id", ids)
    .order("created_at", { ascending: false })
    .limit(options.limit)

  if (options.sections?.length) {
    q = q.in("section", options.sections)
  } else {
    q = q.in("section", PEER_LISTING_SECTIONS_FILTER)
  }

  const { data, error } = await q
  if (error) {
    console.error("[listActiveListingIdsByBrandModelIds]", error.message)
    return []
  }
  return ((data ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => id.length > 0)
}
