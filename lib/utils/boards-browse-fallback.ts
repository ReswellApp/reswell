import {
  hydrateCardListingImages,
  type ListingImageForCard,
} from "../listing-image-display.ts"

export const NEARBY_BROWSE_FALLBACK_RADIUS_MI = 100

export type BrowseFallbackCardRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number | string
  compare_at_price?: number | string | null
  is_good_deal?: boolean | null
  status: string
  created_at?: string
  latitude?: number | null
  longitude?: number | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  tile_gallery_images?: unknown
  listing_images?: ListingImageForCard[] | null
  categories?: { name?: string | null } | { name?: string | null }[] | null
  board_type?: string | null
  condition?: string | null
  suppressed_on_boards_browse?: boolean | null
}

export type BrowseFallbackSourceRow = BrowseFallbackCardRow & {
  description?: string | null
  brand?: string | null
  fins_setup?: string | null
  tail_shape?: string | null
  categories?:
    | { name?: string | null; slug?: string | null }
    | { name?: string | null; slug?: string | null }[]
    | null
}

export type NearbyBrowseFallbackKind =
  | "near-keyword"
  | "near-relaxed"
  | "wide-keyword"
  | "wide-relaxed"

function matchesKeyword(row: BrowseFallbackSourceRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  const categories = Array.isArray(row.categories)
    ? row.categories
    : row.categories
      ? [row.categories]
      : []
  return [
    row.title,
    row.description,
    row.brand,
    row.fins_setup,
    row.tail_shape,
    ...categories.flatMap((category) => [category.name, category.slug]),
  ].some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(needle))
}

function toCardRow(row: BrowseFallbackSourceRow): BrowseFallbackCardRow {
  const {
    id,
    slug,
    user_id,
    title,
    price,
    compare_at_price,
    is_good_deal,
    status,
    created_at,
    latitude,
    longitude,
    local_pickup,
    shipping_available,
    primary_image_url,
    primary_thumbnail_url,
    tile_gallery_images,
    categories,
    board_type,
    condition,
    suppressed_on_boards_browse,
  } = row
  return {
    id,
    slug,
    user_id,
    title,
    price,
    compare_at_price,
    is_good_deal,
    status,
    created_at,
    latitude,
    longitude,
    local_pickup,
    shipping_available,
    primary_image_url,
    primary_thumbnail_url,
    tile_gallery_images,
    categories,
    board_type,
    condition,
    suppressed_on_boards_browse,
  }
}

export function resolveNearbyBrowseFallbackRows(
  rows: Array<BrowseFallbackSourceRow & { _distance: number }>,
  query: string,
): {
  rows: BrowseFallbackCardRow[]
  kind: NearbyBrowseFallbackKind | null
} {
  const ordered = [...rows].sort((a, b) => a._distance - b._distance)
  const keywordRows = query.trim() ? ordered.filter((row) => matchesKeyword(row, query)) : ordered
  const candidates: Array<{
    rows: Array<BrowseFallbackSourceRow & { _distance: number }>
    kind: NearbyBrowseFallbackKind
  }> = [
    {
      rows: keywordRows.filter((row) => row._distance <= NEARBY_BROWSE_FALLBACK_RADIUS_MI),
      kind: "near-keyword",
    },
    {
      rows: ordered.filter((row) => row._distance <= NEARBY_BROWSE_FALLBACK_RADIUS_MI),
      kind: query.trim() ? "near-relaxed" : "near-keyword",
    },
    { rows: keywordRows, kind: "wide-keyword" },
    { rows: ordered, kind: query.trim() ? "wide-relaxed" : "wide-keyword" },
  ]
  const selected = candidates.find((candidate) => candidate.rows.length > 0)
  if (!selected) return { rows: [], kind: null }
  return {
    rows: hydrateCardListingImages(selected.rows.map(toCardRow)),
    kind: selected.kind,
  }
}
