import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"
import { primarySitemapImageUrl } from "@/lib/sitemap/listing-sitemap-image"

export const SITEMAP_LISTING_SELECT =
  "id, slug, updated_at, listing_images(url, thumbnail_url, is_primary, sort_order)"

export type SectionSitemapEntry = {
  path: string
  updatedAt: string | null
  imageUrl: string | null
}

type SitemapListingRow = {
  id: string
  slug?: string | null
  updated_at?: string | null
  listing_images?: unknown
}

export function toSectionSitemapEntry(row: SitemapListingRow): SectionSitemapEntry {
  return {
    path: listingDetailHref({ id: row.id, slug: row.slug }),
    updatedAt: row.updated_at ?? null,
    imageUrl: primarySitemapImageUrl(row.listing_images),
  }
}

/** Active listing URLs for one marketplace section, with the primary photo. */
export async function fetchActiveSectionListingSitemapEntries(
  supabase: SupabaseClient,
  section: string,
  logLabel: string,
): Promise<SectionSitemapEntry[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(SITEMAP_LISTING_SELECT)
    .eq("section", section)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error(`${logLabel}:`, error.message)
    return []
  }

  return ((data ?? []) as SitemapListingRow[]).map(toSectionSitemapEntry)
}
