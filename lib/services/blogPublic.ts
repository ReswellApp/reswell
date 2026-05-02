import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPublishedBlogPostBySlug,
  listPublishedBlogPosts,
  mapBlogRowToArticle,
} from "@/lib/db/blog-posts"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"

/** Public-facing list: published CMS posts only (`listed_on_blog` + `published`). */
export async function listPublishedArticlesForSite(
  supabase: SupabaseClient,
): Promise<FieldNoteArticle[]> {
  const rows = await listPublishedBlogPosts(supabase)
  return rows.map(mapBlogRowToArticle)
}

/** Single article for `/blog/[slug]` (published only unless noted by caller). */
export async function getPublishedArticleBySlugForSite(
  supabase: SupabaseClient,
  slug: string,
): Promise<FieldNoteArticle | undefined> {
  const row = await getPublishedBlogPostBySlug(supabase, slug)
  if (row) return mapBlogRowToArticle(row)
  return undefined
}

/** Same ordering as hub + article rail, excluding current slug. */
export async function listRelatedPublishedForSite(
  supabase: SupabaseClient,
  slug: string,
  limit: number,
): Promise<FieldNoteArticle[]> {
  const all = await listPublishedArticlesForSite(supabase)
  return all.filter((a) => a.slug !== slug).slice(0, limit)
}
