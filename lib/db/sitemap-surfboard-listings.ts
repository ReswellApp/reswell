import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"

const PAGE_SIZE = 1000

/** Stay under Google's 50k URL cap per sitemap after static + filter URLs. */
const MAX_URLS = 48_000

type ListingSitemapRow = {
  id: string
  slug: string | null
  updated_at: string | null
}

export interface SurfboardListingSitemapEntry {
  path: string
  lastModified: Date
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
      .select("id, slug, updated_at")
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

    const rows = (data ?? []) as ListingSitemapRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const path = listingDetailHref({ id: row.id, slug: row.slug })
      const lastModified = row.updated_at ? new Date(row.updated_at) : new Date()
      entries.push({ path, lastModified })
    }

    if (rows.length < batchSize) break
    offset += batchSize
  }

  return entries
}
