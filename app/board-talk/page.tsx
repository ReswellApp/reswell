import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Heart, Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { capitalizeWords } from "@/lib/listing-labels"
import { pageSeoMetadata } from "@/lib/site-metadata"

type ThreadRow = {
  id: string
  title: string
  slug: string
  created_at: string
  updated_at: string
  user_id: string
}

export const metadata: Metadata = pageSeoMetadata({
  title: "Board Talk — Reswell",
  description: "Community posts, Q&A, and surfboard discussions — join the conversation.",
  path: "/board-talk",
})

function countByKey(rows: { thread_id: string }[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows ?? []) {
    out[r.thread_id] = (out[r.thread_id] ?? 0) + 1
  }
  return out
}

/** Top-level comments only (exclude nested replies). */
function countTopLevelComments(
  rows: { thread_id: string; parent_id: string | null }[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows ?? []) {
    if (r.parent_id != null) continue
    out[r.thread_id] = (out[r.thread_id] ?? 0) + 1
  }
  return out
}

export default async function ThreadsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: threads, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug, created_at, updated_at, user_id")
    .order("updated_at", { ascending: false })

  if (error) {
    return (
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <h1 className="text-3xl font-bold text-foreground">Board Talk</h1>
          <p className="mt-5 text-sm text-destructive">
            Could not load Board Talk. Confirm{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/032_forum_threads.sql</code> ran on this
            Supabase project, then try{" "}
            <span className="font-medium">Settings → API → Reload schema</span> in the dashboard.
          </p>
          <p className="mt-2 text-xs text-muted-foreground font-mono break-all">{error.message}</p>
        </div>
      </main>
    )
  }

  const list = (threads as ThreadRow[] | null) ?? []
  const ids = list.map((t) => t.id)
  const userIds = [...new Set(list.map((t) => t.user_id))]

  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }

  const profileById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  let commentCountByThread: Record<string, number> = {}
  let likeCountByThread: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: commentRows } = await supabase
      .from("forum_comments")
      .select("thread_id, parent_id")
      .in("thread_id", ids)
    commentCountByThread = countTopLevelComments(
      commentRows as { thread_id: string; parent_id: string | null }[] | null,
    )
    const { data: likeRows } = await supabase.from("forum_thread_likes").select("thread_id").in("thread_id", ids)
    likeCountByThread = countByKey(likeRows as { thread_id: string }[] | null)
  }

  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <header className="flex flex-col gap-8 border-b border-border/60 pb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-10 sm:pb-12">
          <div className="min-w-0 space-y-3">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Board Talk</h1>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              Start a conversation, share stoke, and jump into what the community is talking about.
            </p>
          </div>
          <div className="shrink-0 sm:pt-1">
            {user ? (
              <Button asChild className="w-full min-h-touch sm:w-auto">
                <Link href="/board-talk/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New post
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full min-h-touch sm:w-auto">
                <Link href={`/auth/login?redirect=${encodeURIComponent("/board-talk/new")}`}>
                  Log in to post
                </Link>
              </Button>
            )}
          </div>
        </header>

        {list.length === 0 && (
          <Card className="mt-10 sm:mt-12">
            <CardContent className="px-6 py-14 text-center text-muted-foreground sm:px-8">
              <p>No posts yet.</p>
              {user ? (
                <Button asChild className="mt-6">
                  <Link href="/board-talk/new">Create the first post</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        <ul className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          {list.map((t) => {
            const comments = commentCountByThread[t.id] ?? 0
            const likes = likeCountByThread[t.id] ?? 0
            const prof = profileById[t.user_id]
            const author = prof?.display_name?.trim() || "Member"
            return (
              <li key={t.id}>
                <Link href={`/board-talk/${t.slug}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
                      <div className="flex flex-wrap items-center gap-2 gap-y-2">
                        <h2 className="pr-2 text-lg font-semibold text-foreground sm:text-xl">
                          {capitalizeWords(t.title)}
                        </h2>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {author}
                        </Badge>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/50 pt-6 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {comments} {comments === 1 ? "comment" : "comments"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" />
                          {likes} {likes === 1 ? "like" : "likes"}
                        </span>
                        <span className="ml-auto sm:ml-0">
                          Active {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
