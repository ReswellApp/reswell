import type { SupabaseClient } from "@supabase/supabase-js"

export interface BlogPostSitemapEntry {
  path: string
  lastModified: Date
}

/**
 * Published posts shown on `/blog` (`listed_on_blog` + `published`).
 */
export async function fetchPublishedBlogPostSitemapEntries(
  supabase: SupabaseClient,
): Promise<BlogPostSitemapEntry[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at")
    .eq("published", true)
    .eq("listed_on_blog", true)
    .order("published_at", { ascending: false })

  if (error) {
    console.error("[sitemap] blog_posts:", error.message)
    return []
  }

  const rows = (data ?? []) as {
    slug: string | null
    updated_at: string | null
    published_at: string | null
  }[]

  const out: BlogPostSitemapEntry[] = []
  for (const row of rows) {
    const slug = row.slug?.trim()
    if (!slug) continue
    const raw =
      row.updated_at?.trim() ||
      row.published_at?.trim() ||
      null
    out.push({
      path: `/blog/${slug}`,
      lastModified: raw ? new Date(raw) : new Date(),
    })
  }
  return out
}
