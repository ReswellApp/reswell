import type { SupabaseClient } from "@supabase/supabase-js"
import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"
import { slugify } from "@/lib/slugify"

export const PUBLIC_RESEARCH_LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  status,
  price,
  condition,
  section,
  brand,
  model,
  board_type,
  dimensions,
  city,
  state,
  shipping_available,
  local_pickup,
  hidden_from_site,
  archived_at,
  listing_images (url, thumbnail_url, is_primary, sort_order),
  ${LISTING_SELLER_PROFILES_EMBED} (seller_slug, display_name, is_shop, shop_name)
`

export type PublicResearchListingImageRow = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export type PublicResearchSellerRow = {
  seller_slug?: string | null
  display_name?: string | null
  is_shop?: boolean | null
  shop_name?: string | null
}

export type PublicResearchListingRow = {
  id: string
  slug: string | null
  title: string | null
  description: string | null
  status: string
  price: number | string | null
  condition: string | null
  section: string
  brand: string | null
  model: string | null
  board_type: string | null
  dimensions: string | null
  city: string | null
  state: string | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  hidden_from_site: boolean | null
  archived_at: string | null
  listing_images: PublicResearchListingImageRow[] | null
  profiles: PublicResearchSellerRow | PublicResearchSellerRow[] | null
}

export type PublicResearchSoldListingEmbed = {
  id: string
  slug: string | null
  title: string | null
  condition: string | null
  dimensions: string | null
  hidden_from_site: boolean | null
  archived_at: string | null
  status: string | null
}

export type PublicResearchSoldOrderRow = {
  amount: number | string | null
  created_at: string
  refunded_at: string | null
  listings: PublicResearchSoldListingEmbed | null
}

function pickJoinedListing(
  value: PublicResearchSoldListingEmbed | PublicResearchSoldListingEmbed[] | null | undefined,
): PublicResearchSoldListingEmbed | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const PRICING_LISTING_SELECT =
  "id, slug, title, status, hidden_from_site, archived_at, brand_id, brand, model, condition, dimensions, price, created_at"

const PRICING_ORDERS_SELECT = `
  amount, created_at, refunded_at,
  listings:listing_id ( id, slug, title, condition, dimensions, hidden_from_site, archived_at, status )
`

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function selectPublicResearchListingsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<PublicResearchListingRow[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(PUBLIC_RESEARCH_LISTING_SELECT)
    .in("id", ids)
    .eq("hidden_from_site", false)

  if (error || !data) {
    if (error) console.error("[public-research-api] listings by id:", error.message)
    return []
  }

  const byId = new Map(
    (data as PublicResearchListingRow[]).map((row) => [row.id, row] as const),
  )
  return ids.map((id) => byId.get(id)).filter((row): row is PublicResearchListingRow => row != null)
}

export async function searchPublicResearchListingsIlike(
  supabase: SupabaseClient,
  q: string,
  sections: string[],
  limit: number,
): Promise<PublicResearchListingRow[]> {
  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`
  const textOr = `title.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`

  let query = supabase
    .from("listings")
    .select(PUBLIC_RESEARCH_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .or(textOr)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (sections.length > 0) {
    query = query.in("section", sections)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[public-research-api] listing search:", error.message)
    return []
  }
  return data as PublicResearchListingRow[]
}

export async function selectBrandModelByBrandAndName(
  supabase: SupabaseClient,
  brandId: string,
  modelRaw: string,
): Promise<{ id: string; name: string } | null> {
  const q = modelRaw.trim()
  if (!q) return null

  const { data, error } = await supabase
    .from("brand_models")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name", { ascending: true })
    .limit(80)

  if (error || !data) {
    if (error) console.error("[public-research-api] brand models:", error.message)
    return null
  }

  const rows = data as { id: string; name: string }[]
  const needle = q.toLowerCase()
  const needleSlug = slugify(q)
  const exact = rows.find((row) => row.name.trim().toLowerCase() === needle)
  if (exact) return { id: exact.id, name: exact.name.trim() }

  const bySlug = rows.find((row) => slugify(row.name) === needleSlug)
  if (bySlug) return { id: bySlug.id, name: bySlug.name.trim() }

  const contains = rows.find((row) => row.name.trim().toLowerCase().includes(needle))
  if (contains) return { id: contains.id, name: contains.name.trim() }

  return null
}

export async function selectSurfboardListingIdsForBrandModelText(
  supabase: SupabaseClient,
  brandId: string,
  modelRaw: string,
  cap: number,
): Promise<string[]> {
  const q = modelRaw.trim()
  if (!q) return []
  const safe = escapeIlikeToken(q)
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("section", "surfboards")
    .eq("brand_id", brandId)
    .ilike("model", `%${safe}%`)
    .limit(cap)

  if (error || !data) {
    if (error) console.error("[public-research-api] model text listing ids:", error.message)
    return []
  }
  return (data as { id: string }[]).map((row) => row.id)
}

export async function selectSnapshotListingIdsForCatalog(
  supabase: SupabaseClient,
  brandSlug: string,
  modelSlug: string | null,
  cap: number,
): Promise<string[]> {
  let query = supabase
    .from("user_listing_board_model_data")
    .select("listing_id")
    .eq("catalog_brand_slug", brandSlug)
    .limit(cap)

  if (modelSlug) {
    query = query.eq("catalog_model_slug", modelSlug)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[public-research-api] catalog snapshots:", error.message)
    return []
  }
  return (data as { listing_id: string }[]).map((row) => row.listing_id)
}

export async function selectSurfboardListingIdsForBrand(
  supabase: SupabaseClient,
  brandId: string,
  cap: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("section", "surfboards")
    .eq("brand_id", brandId)
    .limit(cap)

  if (error || !data) {
    if (error) console.error("[public-research-api] brand listing ids:", error.message)
    return []
  }
  return (data as { id: string }[]).map((row) => row.id)
}

export async function selectActiveSurfboardAskingForPricing(
  supabase: SupabaseClient,
  filters: {
    brandId: string
    listingIds: string[] | null
    limit: number
  },
): Promise<Array<{ price: number | string | null }>> {
  let query = supabase
    .from("listings")
    .select("price")
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("brand_id", filters.brandId)
    .limit(filters.limit)

  if (filters.listingIds) {
    query = query.in("id", filters.listingIds)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[public-research-api] asking prices:", error.message)
    return []
  }
  return data as Array<{ price: number | string | null }>
}

export async function selectSoldSurfboardOrdersForPricing(
  supabase: SupabaseClient,
  filters: {
    listingIds: string[]
    fromIso: string
    limit: number
  },
): Promise<PublicResearchSoldOrderRow[]> {
  if (filters.listingIds.length === 0) return []

  const { data, error } = await supabase
    .from("orders")
    .select(PRICING_ORDERS_SELECT)
    .eq("status", "confirmed")
    .is("refunded_at", null)
    .gte("created_at", filters.fromIso)
    .in("listing_id", filters.listingIds)
    .order("created_at", { ascending: false })
    .limit(filters.limit)

  if (error || !data) {
    if (error) console.error("[public-research-api] sold orders:", error.message)
    return []
  }

  return (
    data as Array<{
      amount: number | string | null
      created_at: string
      refunded_at: string | null
      listings: PublicResearchSoldListingEmbed | PublicResearchSoldListingEmbed[] | null
    }>
  ).map((row) => ({
    amount: row.amount,
    created_at: row.created_at,
    refunded_at: row.refunded_at,
    listings: pickJoinedListing(row.listings),
  }))
}
