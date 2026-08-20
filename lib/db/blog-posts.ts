import type { SupabaseClient } from "@supabase/supabase-js"
import type { ArticleBlock, FieldNoteArticle } from "@/lib/field-notes-articles"
import { articleBlocksSchema } from "@/lib/validations/blog"

export type BlogPostRow = {
  id: string
  slug: string
  title: string
  deck: string
  excerpt: string
  author: string
  published_at: string
  read_minutes: number
  tag: string
  cover_image_url: string | null
  blocks: unknown
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published: boolean
  listed_on_blog: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function parseStoredBlocks(raw: unknown): ArticleBlock[] {
  const parsed = articleBlocksSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("parseStoredBlocks:", parsed.error.flatten())
    return []
  }
  return parsed.data
}

export function mapBlogRowToArticle(row: BlogPostRow): FieldNoteArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    deck: row.deck,
    excerpt: row.excerpt,
    author: row.author,
    publishedAt: row.published_at.slice(0, 10),
    readMinutes: row.read_minutes,
    tag: row.tag,
    coverImage: row.cover_image_url ?? undefined,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    ogImage: row.og_image_url ?? undefined,
    published: row.published,
    listedOnBlog: row.listed_on_blog,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    blocks: parseStoredBlocks(row.blocks),
  }
}

export async function listPublishedBlogPosts(supabase: SupabaseClient): Promise<BlogPostRow[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .eq("listed_on_blog", true)
    .order("sort_order", { ascending: false })
    .order("published_at", { ascending: false })

  if (error) {
    console.error("listPublishedBlogPosts:", error.message)
    return []
  }
  return (data ?? []) as BlogPostRow[]
}

export async function listAllBlogPostsAdmin(supabase: SupabaseClient): Promise<BlogPostRow[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("sort_order", { ascending: false })
    .order("published_at", { ascending: false })

  if (error) {
    console.error("listAllBlogPostsAdmin:", error.message)
    return []
  }
  return (data ?? []) as BlogPostRow[]
}

export async function getPublishedBlogPostBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BlogPostRow | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle()

  if (error) {
    console.error("getPublishedBlogPostBySlug:", error.message)
    return null
  }
  if (!data) return null
  return data as BlogPostRow
}

export async function getBlogPostAdminById(
  supabase: SupabaseClient,
  id: string,
): Promise<BlogPostRow | null> {
  const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle()

  if (error) {
    console.error("getBlogPostAdminById:", error.message)
    return null
  }
  if (!data) return null
  return data as BlogPostRow
}

async function nextBlogSortOrder(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("nextBlogSortOrder:", error.message)
    return Date.now()
  }
  const max = typeof data?.sort_order === "number" ? data.sort_order : 0
  return max + 1000
}

export type BlogPostInsertPayload = {
  slug: string
  title: string
  deck: string
  excerpt: string
  author: string
  publishedAt: string
  readMinutes: number
  tag: string
  coverImage?: string
  blocks: ArticleBlock[]
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  published: boolean
  listedOnBlog?: boolean
  sortOrder?: number
}

export async function insertBlogPost(
  supabase: SupabaseClient,
  payload: BlogPostInsertPayload,
): Promise<{ ok: true; id: string } | { ok: false; error: string; slugTaken?: boolean }> {
  const sortOrder = payload.sortOrder ?? (await nextBlogSortOrder(supabase))

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      slug: payload.slug,
      title: payload.title,
      deck: payload.deck,
      excerpt: payload.excerpt,
      author: payload.author,
      published_at: payload.publishedAt,
      read_minutes: payload.readMinutes,
      tag: payload.tag,
      cover_image_url: payload.coverImage ?? null,
      blocks: payload.blocks,
      seo_title: payload.seoTitle ?? null,
      seo_description: payload.seoDescription ?? null,
      og_image_url: payload.ogImage ?? null,
      published: payload.published,
      listed_on_blog: payload.listedOnBlog !== false,
      sort_order: sortOrder,
    })
    .select("id")
    .single()

  if (error) {
    console.error("insertBlogPost:", error.message)
    const slugTaken = /duplicate|unique/i.test(error.message ?? "")
    return {
      ok: false,
      error: slugTaken ? "That URL slug is already in use." : error.message || "Insert failed",
      slugTaken,
    }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function updateBlogPost(
  supabase: SupabaseClient,
  id: string,
  payload: BlogPostInsertPayload,
): Promise<{ ok: true } | { ok: false; error: string; slugTaken?: boolean }> {
  const { error } = await supabase
    .from("blog_posts")
    .update({
      slug: payload.slug,
      title: payload.title,
      deck: payload.deck,
      excerpt: payload.excerpt,
      author: payload.author,
      published_at: payload.publishedAt,
      read_minutes: payload.readMinutes,
      tag: payload.tag,
      cover_image_url: payload.coverImage ?? null,
      blocks: payload.blocks,
      seo_title: payload.seoTitle ?? null,
      seo_description: payload.seoDescription ?? null,
      og_image_url: payload.ogImage ?? null,
      published: payload.published,
      listed_on_blog: payload.listedOnBlog !== false,
      ...(typeof payload.sortOrder === "number" ? { sort_order: payload.sortOrder } : {}),
    })
    .eq("id", id)

  if (error) {
    console.error("updateBlogPost:", error.message)
    const slugTaken = /duplicate|unique/i.test(error.message ?? "")
    return {
      ok: false,
      error: slugTaken ? "That URL slug is already in use." : error.message || "Update failed",
      slugTaken,
    }
  }
  return { ok: true }
}

export async function updateBlogPostListingFlags(
  supabase: SupabaseClient,
  id: string,
  flags: { published?: boolean; listed_on_blog?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Object.keys(flags).length === 0) {
    return { ok: false, error: "No changes" }
  }
  const { error } = await supabase.from("blog_posts").update(flags).eq("id", id)

  if (error) {
    console.error("updateBlogPostListingFlags:", error.message)
    return { ok: false, error: error.message || "Update failed" }
  }
  return { ok: true }
}

export async function deleteBlogPost(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("blog_posts").delete().eq("id", id).select("id")

  if (error) {
    console.error("deleteBlogPost:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "Post not found" }
  }
  return { ok: true }
}

export async function reorderBlogPosts(
  supabase: SupabaseClient,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const sort_order = (orderedIds.length - i) * 1000
      const { error } = await supabase
        .from("blog_posts")
        .update({ sort_order })
        .eq("id", orderedIds[i])

      if (error) {
        console.error("reorderBlogPosts:", error.message)
        return { ok: false, error: error.message || "Reorder failed" }
      }
    }
    return { ok: true }
  } catch (e) {
    console.error("reorderBlogPosts:", e)
    return { ok: false, error: "Reorder failed" }
  }
}
