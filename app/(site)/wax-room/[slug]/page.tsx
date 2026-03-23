import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThreadLikeButton } from "@/components/forum/thread-like-button"
import { ThreadCommentsPanel, type ThreadCommentRow } from "@/components/forum/thread-comments-panel"
import { capitalizeWords } from "@/lib/listing-labels"
import { formatDistanceToNow } from "date-fns"
import { ThreadDeleteButton } from "@/components/forum/thread-delete-button"
import { AdminThreadEditor } from "@/components/forum/admin-thread-editor"

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

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const supabase = await createClient()
  const { data } = await supabase.from("forum_threads").select("title").eq("slug", slug).maybeSingle()
  if (!data?.title) return { title: "Wax Room" }
  return { title: `${data.title} · Wax Room` }
}

export default async function ThreadDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .select("id, user_id, title, slug, body, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    return (
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl py-10 px-4">
          <p className="text-sm text-destructive">
            Could not load this post. Confirm{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/032_forum_threads.sql</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/036_forum_comment_parent_replies.sql</code>{" "}
            ran and reload
            the API schema in Supabase if needed.
          </p>
          <p className="mt-2 text-xs text-muted-foreground font-mono break-all">{error.message}</p>
          <Link href="/wax-room" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
            ← Wax Room
          </Link>
        </div>
      </main>
    )
  }

  if (!thread) {
    notFound()
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
    .select("id, body, created_at, user_id, parent_id")
    .eq("thread_id", t.id)
    .order("created_at", { ascending: true })

  if (commentsError) {
    return (
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl py-10 px-4">
          <p className="text-sm text-destructive">Could not load comments: {commentsError.message}</p>
          <Link href="/wax-room" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
            ← Wax Room
          </Link>
        </div>
      </main>
    )
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
    profiles: profileById[c.user_id] ?? null,
    forum_comment_likes: [{ count: likeCountByComment[c.id] ?? 0 }],
  }))

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
  const canDeleteThread = isAdmin

  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-3xl py-10 px-4">
        <Link href="/wax-room" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
          ← Wax Room
        </Link>

        <article className="relative mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={authorProfile?.avatar_url || ""} alt="" />
                <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{capitalizeWords(t.title)}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/80">{authorName}</span>
                  {" · "}
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <ThreadLikeButton
                threadId={t.id}
                initialCount={threadLikeCount}
                initialLiked={threadLiked}
                isLoggedIn={!!user}
              />
              {isAdmin && (
                <AdminThreadEditor threadId={t.id} initialTitle={t.title} initialBody={t.body ?? ""} />
              )}
              {canDeleteThread && <ThreadDeleteButton threadId={t.id} />}
            </div>
          </div>
          {t.body ? (
            <div className="mt-6 text-foreground whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{t.body}</div>
          ) : null}

          <div className="mt-6">
            <ThreadCommentsPanel
              threadId={t.id}
              initialComments={comments}
              currentUserId={user?.id ?? null}
              isLoggedIn={!!user}
              likedCommentIds={likedCommentIds}
            />
          </div>
        </article>
      </div>
    </main>
  )
}
