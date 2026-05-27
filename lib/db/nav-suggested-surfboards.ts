import type { SupabaseClient } from "@supabase/supabase-js"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"

import type {
  NavSuggestedSurfboardPoolRow,
  NavSuggestedSurfboardsMode,
} from "@/lib/types/nav-suggested-surfboards"

export type { NavSuggestedSurfboardPoolRow, NavSuggestedSurfboardsMode }

export const NAV_SUGGESTED_SURFBOARD_SELECT =
  "id, slug, title, price, views, created_at, listing_images (url, thumbnail_url, is_primary)"

const POPULAR_POOL_LIMIT = 24
const NEWEST_POOL_LIMIT = 3

export function navSuggestedSurfboardRowFromRecord(
  record: Record<string, unknown>,
): NavSuggestedSurfboardPoolRow {
  const imgs = (record.listing_images as ListingImageForCard[] | null) ?? []
  return {
    id: record.id as string,
    slug: (record.slug as string | null) ?? null,
    title: record.title as string,
    price: Number(record.price),
    views: record.views != null ? Number(record.views) : null,
    created_at: record.created_at as string,
    imageUrl: listingTitleThumbnailSrc(imgs) || null,
  }
}

export async function fetchNavSuggestedSurfboardPool(
  supabase: SupabaseClient,
  mode: NavSuggestedSurfboardsMode,
): Promise<NavSuggestedSurfboardPoolRow[]> {
  const limit = mode === "popular" ? POPULAR_POOL_LIMIT : NEWEST_POOL_LIMIT

  let q = supabase
    .from("listings")
    .select(NAV_SUGGESTED_SURFBOARD_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)

  if (mode === "popular") {
    q = q
      .order("views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
  } else {
    q = q.order("created_at", { ascending: false })
  }

  const { data, error } = await q.limit(limit)
  if (error) throw error
  return (data ?? []).map((row) =>
    navSuggestedSurfboardRowFromRecord(row as Record<string, unknown>),
  )
}

export async function fetchNavSuggestedSurfboardsByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<NavSuggestedSurfboardPoolRow[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(NAV_SUGGESTED_SURFBOARD_SELECT)
    .in("id", unique)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)

  if (error) throw error
  return (data ?? []).map((row) =>
    navSuggestedSurfboardRowFromRecord(row as Record<string, unknown>),
  )
}
