import type { SupabaseClient } from "@supabase/supabase-js"
import {
  SITEMAP_LISTING_SELECT,
  toSectionSitemapEntry,
} from "@/lib/db/sitemap-section-listings"

const PAGE_SIZE = 1000

/** Stay under Google's 50k URL cap per sitemap after static + filter URLs. */
const MAX_URLS = 48_000

export interface SurfboardListingSitemapEntry {
  path: string
  lastModified: Date
  imageUrl: string | null
}

/**
 * Active surfboard rows visible on `/boards` — ids/slugs for `/l/{slug-or-id}`.
 */
export async function fetchSurfboardListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<SurfboardListingSitemapEntry[]> {
  const entries: SurfboardListingSitemapEntry[] = []
  let offset = 0

  while (entries.length < MAX_URLS) {
    const remaining = MAX_URLS - entries.length
    const batchSize = Math.min(PAGE_SIZE, remaining)

    const { data, error } = await supabase
      .from("listings")
      .select(SITEMAP_LISTING_SELECT)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error("[sitemap] surfboard listings:", error.message)
      break
    }

    const rows = (data ?? []) as Parameters<typeof toSectionSitemapEntry>[0][]
    if (rows.length === 0) break

    for (const row of rows) {
      const mapped = toSectionSitemapEntry(row)
      entries.push({
        path: mapped.path,
        lastModified: mapped.updatedAt ? new Date(mapped.updatedAt) : new Date(),
        imageUrl: mapped.imageUrl,
      })
    }

    if (rows.length < batchSize) break
    offset += batchSize
  }

  return entries
}
