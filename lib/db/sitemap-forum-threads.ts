import type { SupabaseClient } from "@supabase/supabase-js"

export interface ForumThreadSitemapEntry {
  path: string
  lastModified: Date
}

type ForumThreadSitemapRow = {
  slug: string | null
  updated_at: string | null
}

const PAGE_SIZE = 1000

/** Stay under per-sitemap URL caps alongside listings + static URLs. */
const MAX_URLS = 20_000

/**
 * Board Talk thread URLs (`/board-talk/[slug]`).
 */
export async function fetchForumThreadSitemapEntries(
  supabase: SupabaseClient,
): Promise<ForumThreadSitemapEntry[]> {
  const entries: ForumThreadSitemapEntry[] = []
  let offset = 0

  while (entries.length < MAX_URLS) {
    const remaining = MAX_URLS - entries.length
    const batchSize = Math.min(PAGE_SIZE, remaining)

    const { data, error } = await supabase
      .from("forum_threads")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error("[sitemap] forum_threads:", error.message)
      break
    }

    const rows = (data ?? []) as ForumThreadSitemapRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const slug = row.slug?.trim()
      if (!slug) continue
      entries.push({
        path: `/board-talk/${slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      })
    }

    if (rows.length < batchSize) break
    offset += batchSize
  }

  return entries
}
