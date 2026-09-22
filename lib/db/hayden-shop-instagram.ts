import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"

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
  construction,
  fin_system,
  fins_setup,
  fins_included,
  status,
  hidden_from_site,
  archived_at,
  created_at,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

export type HaydenShopInstagramListingImage = {
  url: string | null
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type HaydenShopInstagramListingRow = {
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
  construction: string | null
  fin_system: string | null
  fins_setup: string | null
  fins_included: boolean | null
  status: string
  hidden_from_site: boolean | null
  archived_at: string | null
  created_at: string
  listing_images: HaydenShopInstagramListingImage[] | null
}

export type HaydenShopInstagramSeller = {
  id: string
  seller_slug: string | null
  display_name: string | null
  shop_name: string | null
}

function toListingRow(raw: Record<string, unknown>): HaydenShopInstagramListingRow {
  const imagesRaw = raw.listing_images
  const listing_images = Array.isArray(imagesRaw)
    ? (imagesRaw as HaydenShopInstagramListingImage[])
    : null
  const priceRaw = raw.price
  const price =
    typeof priceRaw === "number" ? priceRaw : Number.parseFloat(String(priceRaw ?? "")) || 0

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
    construction: typeof raw.construction === "string" ? raw.construction : null,
    fin_system: typeof raw.fin_system === "string" ? raw.fin_system : null,
    fins_setup: typeof raw.fins_setup === "string" ? raw.fins_setup : null,
    fins_included: typeof raw.fins_included === "boolean" ? raw.fins_included : null,
    status: String(raw.status ?? ""),
    hidden_from_site: raw.hidden_from_site === true,
    archived_at: typeof raw.archived_at === "string" ? raw.archived_at : null,
    created_at: String(raw.created_at ?? ""),
    listing_images,
  }
}

export function isHaydenShopInstagramListing(row: {
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

export async function getHaydenShopInstagramSeller(
  supabase: SupabaseClient,
  userId: string,
): Promise<HaydenShopInstagramSeller | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, seller_slug, display_name, shop_name")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    id: String(data.id),
    seller_slug: typeof data.seller_slug === "string" ? data.seller_slug : null,
    display_name: typeof data.display_name === "string" ? data.display_name : null,
    shop_name: typeof data.shop_name === "string" ? data.shop_name : null,
  }
}

export async function listHaydenShopInstagramListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<HaydenShopInstagramListingRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("archived_at", null)
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[])
    .map(toListingRow)
    .filter(isHaydenShopInstagramListing)
}

export async function getHaydenShopInstagramListing(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<HaydenShopInstagramListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const row = toListingRow(data as Record<string, unknown>)
  return isHaydenShopInstagramListing(row) ? row : null
}
