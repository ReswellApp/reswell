import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ThreadDetailView } from "@/components/features/forum/thread-detail-view"
import { type ThreadCommentRow } from "@/components/forum/thread-comments-panel"
import {
  isForumCommentOpeningPost,
  parseForumCommentImageAttachment,
} from "@/lib/validations/forum-comment-attachment"
import { fetchForumThreadParticipantsByThreadIds } from "@/lib/db/forum-threads"
import { absoluteUrl } from "@/lib/site-metadata"

const RESERVED_THREAD_SLUGS = new Set(["new", "reviews", "whats-new", "forums"])

type ThreadCore = {
  id: string
  user_id: string
  title: string
  slug: string
  body: string | null
  created_at: string
  updated_at: string
}

function commentLikeCountsFromRows(rows: { comment_id: string }[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows ?? []) {
    out[r.comment_id] = (out[r.comment_id] ?? 0) + 1
  }
  return out
}

function threadExcerpt(body: string | null | undefined): string | undefined {
  if (!body?.trim()) return undefined
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!plain) return undefined
  return plain.length > 170 ? `${plain.slice(0, 167)}…` : plain
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const supabase = await createClient()
  const { data } = await supabase
    .from("forum_threads")
    .select("title, body")
    .eq("slug", slug)
    .maybeSingle()
  if (!data?.title) {
    return { title: "Threads — Reswell", description: "Community discussions about surfboards and gear." }
  }
  const excerpt = threadExcerpt((data as { body?: string | null }).body)
  const title = `${data.title} · Threads — Reswell`
  const description = excerpt ?? `Join the conversation: ${data.title} — Threads on Reswell.`
  const path = `/threads/${slug}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: data.title,
      description,
      type: "article",
      url: absoluteUrl(path),
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description,
    },
  }
}

export default async function ThreadDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (RESERVED_THREAD_SLUGS.has(slug)) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .select("id, user_id, title, slug, body, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle()

  if (error || !thread) {
    if (!thread) notFound()
    throw new Error(error?.message ?? "Could not load thread")
  }

  const t = thread as ThreadCore

  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", t.user_id)
    .maybeSingle()

  const { count: threadLikeCountRaw } = await supabase
    .from("forum_thread_likes")
    .select("*", { count: "exact", head: true })
    .eq("thread_id", t.id)
  const threadLikeCount = threadLikeCountRaw ?? 0

  const { data: commentsRaw, error: commentsError } = await supabase
    .from("forum_comments")
    .select("id, body, created_at, user_id, parent_id, metadata")
    .eq("thread_id", t.id)
    .order("created_at", { ascending: true })

  if (commentsError) {
    throw new Error(commentsError.message)
  }

  const commentsBase = commentsRaw ?? []
  const commentAuthorIds = [...new Set(commentsBase.map((c) => c.user_id))]
  const { data: commentProfiles } =
    commentAuthorIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", commentAuthorIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }

  const profileById = Object.fromEntries((commentProfiles ?? []).map((p) => [p.id, p]))

  const cids = commentsBase.map((c) => c.id)
  let likeCountByComment: Record<string, number> = {}
  if (cids.length > 0) {
    const { data: likeRows } = await supabase.from("forum_comment_likes").select("comment_id").in("comment_id", cids)
    likeCountByComment = commentLikeCountsFromRows(likeRows as { comment_id: string }[] | null)
  }

  const comments: ThreadCommentRow[] = commentsBase.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    user_id: c.user_id,
    parent_id: c.parent_id ?? null,
    metadata: (c as { metadata?: unknown }).metadata ?? null,
    profiles: profileById[c.user_id] ?? null,
    forum_comment_likes: [{ count: likeCountByComment[c.id] ?? 0 }],
  }))

  const openingPhotoRow = comments.find((c) => isForumCommentOpeningPost(c.metadata))
  const openingPhotoAttachment = openingPhotoRow
    ? parseForumCommentImageAttachment(openingPhotoRow.metadata)
    : null
  const openingPhoto =
    openingPhotoRow && openingPhotoAttachment
      ? {
          commentId: openingPhotoRow.id,
          fileName: openingPhotoAttachment.file_name,
          body: openingPhotoRow.body,
        }
      : null
  const replyComments = openingPhotoRow
    ? comments.filter((c) => c.id !== openingPhotoRow.id)
    : comments

  let threadLiked = false
  const likedCommentIds: string[] = []
  if (user) {
    const { data: tl } = await supabase
      .from("forum_thread_likes")
      .select("thread_id")
      .eq("thread_id", t.id)
      .eq("user_id", user.id)
      .maybeSingle()
    threadLiked = !!tl

    if (cids.length > 0) {
      const { data: cls } = await supabase
        .from("forum_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", cids)
      for (const row of cls ?? []) {
        if (row.comment_id) likedCommentIds.push(row.comment_id)
      }
    }
  }

  const authorName = authorProfile?.display_name?.trim() || "Member"
  let isAdmin = false
  if (user) {
    const { data: modProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    isAdmin = modProfile?.is_admin === true
  }

  const participantsByThread = await fetchForumThreadParticipantsByThreadIds(supabase, [t])
  const participants = participantsByThread[t.id] ?? []
  const participantUserIds = new Set([t.user_id, ...commentsBase.map((c) => c.user_id)])

  return (
    <ThreadDetailView
      threadId={t.id}
      threadSlug={t.slug}
      title={t.title}
      body={t.body}
      openingPhoto={openingPhoto}
      createdAt={t.created_at}
      authorName={authorName}
      authorAvatarUrl={authorProfile?.avatar_url ?? null}
      threadLikeCount={threadLikeCount}
      threadLiked={threadLiked}
      isLoggedIn={!!user}
      isAdmin={isAdmin}
      canDeleteThread={isAdmin}
      comments={replyComments}
      currentUserId={user?.id ?? null}
      likedCommentIds={likedCommentIds}
      participants={participants}
      participantCount={participantUserIds.size}
    />
  )
}
