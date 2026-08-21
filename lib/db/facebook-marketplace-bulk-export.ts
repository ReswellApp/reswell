import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

const PROFILE_PICK_FIELDS =
  "id, seller_slug, display_name, shop_name, shop_logo_url, avatar_url, city, shop_address, shop_verified" as const

const LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  price,
  condition,
  section,
  board_type,
  brand,
  model,
  dimensions,
  status,
  hidden_from_site,
  archived_at,
  created_at,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export type FacebookMarketplaceBulkSellerHit = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
  city: string | null
  shop_address: string | null
  shop_verified: boolean
  active_listing_count: number
}

export type FacebookMarketplaceBulkListingImage = {
  url: string | null
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type FacebookMarketplaceBulkListingRow = {
  id: string
  slug: string | null
  title: string
  description: string | null
  price: number
  condition: string | null
  section: string
  board_type: string | null
  brand: string | null
  model: string | null
  dimensions: string | null
  status: string
  hidden_from_site: boolean | null
  archived_at: string | null
  created_at: string
  listing_images: FacebookMarketplaceBulkListingImage[] | null
}

export type FacebookMarketplaceBulkSellerProfile = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
}

function isExportableListing(row: {
  title: string
  status: string
  hidden_from_site: boolean | null
  archived_at: string | null
}): boolean {
  if (isAdminSeedListingTitle(row.title)) return false
  if (row.archived_at) return false
  if (row.hidden_from_site) return false
  return row.status === "active"
}

function toListingRow(raw: Record<string, unknown>): FacebookMarketplaceBulkListingRow {
  const imagesRaw = raw.listing_images
  const listing_images = Array.isArray(imagesRaw)
    ? (imagesRaw as FacebookMarketplaceBulkListingImage[])
    : null
  const priceRaw = raw.price
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : Number.parseFloat(String(priceRaw ?? "")) || 0

  return {
    id: String(raw.id),
    slug: typeof raw.slug === "string" ? raw.slug : null,
    title: String(raw.title ?? ""),
    description: typeof raw.description === "string" ? raw.description : null,
    price,
    condition: typeof raw.condition === "string" ? raw.condition : null,
    section: String(raw.section ?? "surfboards"),
    board_type: typeof raw.board_type === "string" ? raw.board_type : null,
    brand: typeof raw.brand === "string" ? raw.brand : null,
    model: typeof raw.model === "string" ? raw.model : null,
    dimensions: typeof raw.dimensions === "string" ? raw.dimensions : null,
    status: String(raw.status ?? ""),
    hidden_from_site: raw.hidden_from_site === true,
    archived_at: typeof raw.archived_at === "string" ? raw.archived_at : null,
    created_at: String(raw.created_at ?? ""),
    listing_images,
  }
}

export async function searchSellersForFacebookMarketplaceBulkExport(
  supabase: SupabaseClient,
  qRaw: string,
  limit: number,
): Promise<FacebookMarketplaceBulkSellerHit[]> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) return []

  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`
  const cap = Math.min(Math.max(limit, 1), 100)

  const { data: matchRows, error: matchErr } = await supabase
    .from("profiles")
    .select(PROFILE_PICK_FIELDS)
    .or(
      `shop_name.ilike.${pattern},display_name.ilike.${pattern},seller_slug.ilike.${pattern},city.ilike.${pattern},shop_address.ilike.${pattern}`,
    )
    .not("seller_slug", "is", null)
    .order("shop_verified", { ascending: false })
    .limit(cap)

  if (matchErr || !matchRows) {
    if (matchErr) {
      console.error("searchSellersForFacebookMarketplaceBulkExport:", matchErr.message)
    }
    return []
  }

  const hits = (matchRows as Record<string, unknown>[])
    .map((row) => {
      const sellerSlug = ((row.seller_slug as string | null) ?? "").trim()
      if (!sellerSlug) return null
      return {
        id: row.id as string,
        seller_slug: sellerSlug,
        display_name: (row.display_name as string | null) ?? null,
        shop_name: (row.shop_name as string | null) ?? null,
        shop_logo_url: (row.shop_logo_url as string | null) ?? null,
        avatar_url: (row.avatar_url as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        shop_address: (row.shop_address as string | null) ?? null,
        shop_verified: Boolean(row.shop_verified),
        active_listing_count: 0,
      } satisfies FacebookMarketplaceBulkSellerHit
    })
    .filter((row): row is FacebookMarketplaceBulkSellerHit => row != null)

  if (hits.length === 0) return []

  const ids = hits.map((hit) => hit.id)
  const { data: listingRows, error: listingErr } = await supabase
    .from("listings")
    .select("user_id")
    .in("user_id", ids)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

  if (listingErr) {
    console.error("searchSellersForFacebookMarketplaceBulkExport (listings):", listingErr.message)
    return hits
  }

  const counts = new Map<string, number>()
  for (const row of listingRows ?? []) {
    const userId = (row as { user_id?: string }).user_id
    if (!userId) continue
    counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }

  return hits
    .map((hit) => ({
      ...hit,
      active_listing_count: counts.get(hit.id) ?? 0,
    }))
    .sort((a, b) => b.active_listing_count - a.active_listing_count || Number(b.shop_verified) - Number(a.shop_verified))
}

export async function getFacebookMarketplaceBulkSellerProfile(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<FacebookMarketplaceBulkSellerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, seller_slug, display_name, shop_name")
    .eq("id", sellerId)
    .maybeSingle()

  if (error) {
    console.error("getFacebookMarketplaceBulkSellerProfile:", error.message)
    return null
  }
  if (!data) return null

  const sellerSlug = (data.seller_slug as string | null)?.trim() ?? ""
  if (!sellerSlug) return null

  return {
    id: data.id as string,
    seller_slug: sellerSlug,
    display_name: (data.display_name as string | null) ?? null,
    shop_name: (data.shop_name as string | null) ?? null,
  }
}

export async function listActiveListingsForFacebookMarketplaceBulkExport(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<FacebookMarketplaceBulkListingRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("user_id", sellerId)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("listActiveListingsForFacebookMarketplaceBulkExport:", error.message)
    throw new Error("Could not load seller listings")
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map(toListingRow)
    .filter(isExportableListing)
}

export async function listSelectedListingsForFacebookMarketplaceBulkExport(
  supabase: SupabaseClient,
  sellerId: string,
  listingIds: string[],
): Promise<FacebookMarketplaceBulkListingRow[]> {
  if (listingIds.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("user_id", sellerId)
    .in("id", listingIds)

  if (error) {
    console.error("listSelectedListingsForFacebookMarketplaceBulkExport:", error.message)
    throw new Error("Could not load selected listings")
  }

  const byId = new Map(
    ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const listing = toListingRow(row)
      return [listing.id, listing] as const
    }),
  )

  return listingIds
    .map((id) => byId.get(id) ?? null)
    .filter((row): row is FacebookMarketplaceBulkListingRow => row != null && isExportableListing(row))
}
