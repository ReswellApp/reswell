import type { SupabaseClient } from "@supabase/supabase-js"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_FORUM_THREADS_INDEX } from "./config"

export type ForumThreadSearchDoc = {
  id: string
  title: string
  slug: string
  body: string
  author_id: string
  author_name: string
  comment_bodies: string
  created_at: string
  updated_at: string
}

const INDEX_SETTINGS = {
  analysis: {
    normalizer: {
      lowercase: {
        type: "custom" as const,
        filter: ["lowercase", "asciifolding"],
      },
    },
    analyzer: {
      forum_text: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
}

const INDEX_MAPPINGS = {
  properties: {
    id: { type: "keyword" as const },
    title: {
      type: "text" as const,
      analyzer: "forum_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    slug: { type: "keyword" as const },
    body: { type: "text" as const, analyzer: "forum_text" },
    author_id: { type: "keyword" as const },
    author_name: {
      type: "text" as const,
      analyzer: "forum_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    comment_bodies: { type: "text" as const, analyzer: "forum_text" },
    created_at: { type: "date" as const },
    updated_at: { type: "date" as const },
  },
}

export async function ensureForumThreadsIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_FORUM_THREADS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_FORUM_THREADS_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureForumThreadsIndex failed:", msg, e)
  }
}

export async function indexForumThreadDocument(doc: ForumThreadSearchDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureForumThreadsIndex()
  await es.index({
    index: ELASTICSEARCH_FORUM_THREADS_INDEX,
    id: doc.id,
    document: doc,
    refresh: false,
  })
}

export async function deleteForumThreadDocument(threadId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_FORUM_THREADS_INDEX,
      id: threadId,
      refresh: false,
    })
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    throw e
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export async function forumThreadRowToSearchDoc(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ForumThreadSearchDoc | null> {
  const { data: thread, error } = await supabase
    .from("forum_threads")
    .select("id, user_id, title, slug, body, created_at, updated_at")
    .eq("id", threadId)
    .maybeSingle()

  if (error || !thread) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, shop_name")
    .eq("id", thread.user_id)
    .maybeSingle()

  const authorName =
    profile?.display_name?.trim() ||
    profile?.shop_name?.trim() ||
    "Member"

  const { data: comments } = await supabase
    .from("forum_comments")
    .select("body")
    .eq("thread_id", threadId)

  const commentBodies = (comments ?? [])
    .map((c) => stripHtml(String(c.body ?? "")))
    .filter(Boolean)
    .join("\n")

  return {
    id: thread.id,
    title: thread.title ?? "",
    slug: thread.slug ?? "",
    body: stripHtml(String(thread.body ?? "")),
    author_id: thread.user_id,
    author_name: authorName,
    comment_bodies: commentBodies,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
  }
}

export async function syncForumThreadToIndex(
  supabase: SupabaseClient,
  threadId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const doc = await forumThreadRowToSearchDoc(supabase, threadId)
  if (!doc) {
    await deleteForumThreadDocument(threadId)
    return
  }

  await indexForumThreadDocument(doc)
}

/**
 * Full-text search over forum threads (title, body, author, comment text).
 * Returns thread ids in relevance order.
 */
export async function searchForumThreadIdsFromElasticsearch(
  rawQuery: string,
  limit: number,
): Promise<string[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  const q = rawQuery.trim()
  if (!q) return []

  try {
    const res = await es.search({
      index: ELASTICSEARCH_FORUM_THREADS_INDEX,
      size: limit,
      _source: false,
      track_total_hits: false,
      query: {
        multi_match: {
          query: q,
          type: "best_fields",
          fields: ["title^4", "body^2", "author_name^2", "comment_bodies"],
          fuzziness: "AUTO",
        },
      },
      sort: [{ _score: { order: "desc" } }, { updated_at: { order: "desc" } }],
    })

    return (res.hits.hits ?? [])
      .map((h) => h._id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] searchForumThreadIdsFromElasticsearch failed:", msg, e)
    throw e
  }
}
