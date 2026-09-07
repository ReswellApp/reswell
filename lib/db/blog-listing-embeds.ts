import type { SupabaseClient } from "@supabase/supabase-js"
import { findListingByParam } from "@/lib/listing-query"
import { fetchHomeRecentlySoldSurfboardRows } from "@/lib/db/home-recently-sold-strip"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import {
  isListingPubliclyVisible,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import type { BlogEmbedListing } from "@/lib/types/blog-listing-embed"

const BLOG_EMBED_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  status,
  section,
  condition,
  board_type,
  hidden_from_site,
  archived_at,
  shipping_available,
  local_pickup,
  listing_images (url, thumbnail_url, is_primary, sort_order),
  categories (name)
`

type EmbedListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: string | number | null
  status: string | null
  section: string | null
  condition?: string | null
  board_type?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  listing_images?: ListingImageForCard[] | null
  categories?: { name?: string | null } | { name?: string | null }[] | null
}

function isEmbedListingRow(data: unknown): data is EmbedListingRow {
  if (typeof data !== "object" || data === null) return false
  const row = data as Record<string, unknown>
  return typeof row.id === "string" && typeof row.title === "string"
}

export function mapBlogEmbedListingRow(row: EmbedListingRow): BlogEmbedListing {
  return {
    id: row.id,
    slug: row.slug,
    user_id: row.user_id,
    title: row.title,
    price: publicListingListPriceUsd(row.price),
    status: String(row.status ?? "active"),
    section: row.section ?? "surfboards",
    local_pickup: row.local_pickup,
    shipping_available: row.shipping_available,
    listing_images: row.listing_images ?? null,
    categories: row.categories ?? null,
    board_type: row.board_type ?? null,
    condition: row.condition?.trim() ? row.condition : null,
  }
}

function listingAllowedInBlog(row: EmbedListingRow): boolean {
  const fields = {
    status: String(row.status ?? ""),
    title: row.title,
    hidden_from_site: row.hidden_from_site,
    archived_at: row.archived_at,
  }
  return isListingPubliclyVisible(fields) || isListingVisibleInPublicSoldFeed(fields)
}

export async function getBlogEmbedListingByParam(
  supabase: SupabaseClient,
  param: string,
): Promise<BlogEmbedListing | null> {
  const { listing } = await findListingByParam(supabase, param, {
    select: BLOG_EMBED_LISTING_SELECT,
    includeHiddenListings: false,
  })
  if (!isEmbedListingRow(listing) || !listingAllowedInBlog(listing)) return null
  return mapBlogEmbedListingRow(listing)
}

export async function listBlogRecentlySoldEmbeds(
  supabase: SupabaseClient,
  limit: number,
): Promise<BlogEmbedListing[]> {
  const rows = await fetchHomeRecentlySoldSurfboardRows(supabase)
  const mapped: BlogEmbedListing[] = []
  for (const raw of rows) {
    if (!isEmbedListingRow(raw) || !listingAllowedInBlog(raw)) continue
    mapped.push(mapBlogEmbedListingRow(raw))
    if (mapped.length >= limit) break
  }
  return mapped
}
