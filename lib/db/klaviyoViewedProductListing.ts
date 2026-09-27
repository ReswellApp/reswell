import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  KlaviyoListingImage,
  KlaviyoListingProductSource,
} from "@/lib/klaviyo/catalog-product"
import { isUUID } from "@/lib/slugify"

const VIEWED_PRODUCT_LISTING_SELECT = `
  id,
  slug,
  title,
  price,
  section,
  brand,
  board_type,
  condition,
  city,
  state,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`

function listingImageList(value: unknown): KlaviyoListingImage[] | null {
  if (!Array.isArray(value)) return null
  const images: KlaviyoListingImage[] = []
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue
    const row = item as Record<string, unknown>
    images.push({
      url: typeof row.url === "string" ? row.url : null,
      thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
      is_primary: typeof row.is_primary === "boolean" ? row.is_primary : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    })
  }
  return images
}

function toProductSource(data: unknown): KlaviyoListingProductSource | null {
  if (typeof data !== "object" || data === null) return null
  const row = data as Record<string, unknown>
  if (typeof row.id !== "string" || !row.id.trim()) return null
  const price =
    typeof row.price === "number" || typeof row.price === "string" ? row.price : null
  return {
    id: row.id,
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" ? row.title : null,
    price,
    section: typeof row.section === "string" ? row.section : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    board_type: typeof row.board_type === "string" ? row.board_type : null,
    condition: typeof row.condition === "string" ? row.condition : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    listing_images: listingImageList(row.listing_images),
  }
}

/** Public listing behind `/l/{slug-or-id}` for the Viewed Product event. */
export async function fetchPublicListingForViewedProduct(
  supabase: SupabaseClient,
  param: string,
): Promise<KlaviyoListingProductSource | null> {
  const key = param.trim()
  if (!key) return null

  const column = isUUID(key) ? "id" : "slug"
  const { data, error } = await supabase
    .from("listings")
    .select(VIEWED_PRODUCT_LISTING_SELECT)
    .eq(column, key)
    .eq("hidden_from_site", false)
    .maybeSingle()

  if (error) {
    console.error("[klaviyo] viewed product listing lookup:", error.message)
    return null
  }
  return toProductSource(data)
}
