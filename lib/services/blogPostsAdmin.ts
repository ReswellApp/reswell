import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  deleteBlogPost,
  getBlogPostAdminById,
  insertBlogPost,
  listAllBlogPostsAdmin,
  mapBlogRowToArticle,
  reorderBlogPosts,
  updateBlogPost,
  updateBlogPostListingFlags,
  type BlogPostInsertPayload,
} from "@/lib/db/blog-posts"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { adminBlogPostWriteSchema } from "@/lib/validations/blog"

export type BlogPostDraftInput = z.infer<typeof adminBlogPostWriteSchema>

function draftToPayload(draft: BlogPostDraftInput): BlogPostInsertPayload {
  return {
    slug: draft.slug,
    title: draft.title,
    deck: draft.deck,
    excerpt: draft.excerpt,
    author: draft.author,
    publishedAt: draft.publishedAt,
    readMinutes: draft.readMinutes,
    tag: draft.tag,
    coverImage: draft.coverImage,
    blocks: draft.blocks,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    ogImage: draft.ogImage,
    published: draft.published,
    listedOnBlog: draft.listedOnBlog,
    sortOrder: draft.sortOrder,
  }
}

export async function adminListBlogArticlesService(supabase: SupabaseClient): Promise<FieldNoteArticle[]> {
  const rows = await listAllBlogPostsAdmin(supabase)
  return rows.map(mapBlogRowToArticle)
}

export async function adminGetBlogArticleService(
  supabase: SupabaseClient,
  id: string,
): Promise<FieldNoteArticle | null> {
  const row = await getBlogPostAdminById(supabase, id)
  if (!row) return null
  return mapBlogRowToArticle(row)
}

export async function adminCreateBlogPostService(
  supabase: SupabaseClient,
  draft: BlogPostDraftInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string; slugTaken?: boolean }> {
  return insertBlogPost(supabase, draftToPayload(draft))
}

export async function adminUpdateBlogPostService(
  supabase: SupabaseClient,
  id: string,
  draft: BlogPostDraftInput,
): Promise<{ ok: true } | { ok: false; error: string; slugTaken?: boolean }> {
  return updateBlogPost(supabase, id, draftToPayload(draft))
}

export async function adminDeleteBlogPostService(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deleteBlogPost(supabase, id)
}

export type BlogVisibilityAction = "hide" | "show" | "archive"

export async function adminBlogPostVisibilityActionService(
  supabase: SupabaseClient,
  id: string,
  action: BlogVisibilityAction,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const row = await getBlogPostAdminById(supabase, id)
  if (!row) return { ok: false, error: "Post not found" }

  if (action === "hide") {
    if (!row.published) {
      return { ok: false, error: "Only published posts can be hidden from the index." }
    }
    const r = await updateBlogPostListingFlags(supabase, id, { listed_on_blog: false })
    if (!r.ok) return r
    return { ok: true, slug: row.slug }
  }

  if (action === "show") {
    if (!row.published) {
      return { ok: false, error: "Publish the post first to show it on the blog index." }
    }
    const r = await updateBlogPostListingFlags(supabase, id, { listed_on_blog: true })
    if (!r.ok) return r
    return { ok: true, slug: row.slug }
  }

  const r = await updateBlogPostListingFlags(supabase, id, { published: false, listed_on_blog: false })
  if (!r.ok) return r
  return { ok: true, slug: row.slug }
}

export async function adminReorderBlogPostsService(
  supabase: SupabaseClient,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  return reorderBlogPosts(supabase, orderedIds)
}
