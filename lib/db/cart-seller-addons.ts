import type { SupabaseClient } from "@supabase/supabase-js"
import { isListingPurchasable } from "@/lib/listing-public-visibility"

export const CART_SELLER_ADDON_SECTIONS = [
  "fins",
  "leashes",
  "accessories",
  "boardbags",
] as const

export type CartSellerAddonSection = (typeof CART_SELLER_ADDON_SECTIONS)[number]

export type CartSellerAddonRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  section: string
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_type: string | null
  condition: string | null
  fin_system: string | null
  listing_images: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
  categories: { name?: string | null } | null
}

export type CartHostFinSystemRow = {
  id: string
  fin_system: string | null
}

const ADDON_SELECT = `
  id,
  slug,
  title,
  price,
  status,
  section,
  user_id,
  local_pickup,
  shipping_available,
  hidden_from_site,
  archived_at,
  board_type,
  condition,
  fin_system,
  listing_images ( url, thumbnail_url, is_primary ),
  categories ( name )
`

type AddonQueryRow = CartSellerAddonRow & {
  hidden_from_site?: boolean | null
  archived_at?: string | null
  categories?: { name?: string | null } | { name?: string | null }[] | null
}

function normalizeCategories(
  cat: AddonQueryRow["categories"],
): { name?: string | null } | null {
  if (!cat) return null
  return Array.isArray(cat) ? (cat[0] ?? null) : cat
}

/**
 * Active add-on listings from cart sellers (fins, leashes, accessories, boardbags).
 * Excludes listings already in the cart and anything not publicly purchasable.
 */
export async function fetchCartSellerAddonListings(
  supabase: SupabaseClient,
  sellerIds: string[],
  options: { excludeListingIds?: string[]; limit?: number } = {},
): Promise<{ listings: CartSellerAddonRow[]; error: string | null }> {
  if (sellerIds.length === 0) {
    return { listings: [], error: null }
  }

  const limit = options.limit ?? 48
  const { data, error } = await supabase
    .from("listings")
    .select(ADDON_SELECT)
    .in("user_id", sellerIds)
    .in("section", [...CART_SELLER_ADDON_SECTIONS])
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { listings: [], error: error.message }
  }

  const exclude = new Set(options.excludeListingIds ?? [])
  const listings: CartSellerAddonRow[] = []

  for (const raw of data ?? []) {
    const row = raw as AddonQueryRow
    if (exclude.has(row.id)) continue
    if (!isListingPurchasable(row)) continue
    const lp = row.local_pickup !== false
    const sa = Boolean(row.shipping_available)
    if (!lp && !sa) continue

    listings.push({
      id: row.id,
      slug: row.slug,
      user_id: row.user_id,
      title: row.title,
      price: typeof row.price === "number" ? row.price : Number(row.price),
      status: row.status,
      section: row.section,
      local_pickup: row.local_pickup,
      shipping_available: row.shipping_available,
      board_type: row.board_type,
      condition: row.condition,
      fin_system: row.fin_system,
      listing_images: row.listing_images,
      categories: normalizeCategories(row.categories),
    })
  }

  return { listings, error: null }
}

export async function fetchCartHostFinSystems(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<{ rows: CartHostFinSystemRow[]; error: string | null }> {
  if (listingIds.length === 0) {
    return { rows: [], error: null }
  }

  const { data, error } = await supabase
    .from("listings")
    .select("id, fin_system")
    .in("id", listingIds)

  if (error) {
    return { rows: [], error: error.message }
  }

  const rows: CartHostFinSystemRow[] = []
  for (const raw of data ?? []) {
    const row = raw as { id?: unknown; fin_system?: unknown }
    if (typeof row.id !== "string" || !row.id) continue
    rows.push({
      id: row.id,
      fin_system: typeof row.fin_system === "string" ? row.fin_system : null,
    })
  }

  return { rows, error: null }
}
