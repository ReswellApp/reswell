import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkForumsView } from "@/components/features/forum/board-talk-forums-view"
import { getBoardTalkForumThreads } from "@/lib/services/forumThreads"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("board-talk")
}

export default async function ThreadsForumsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>
}) {
  const { q: rawQ, sort: rawSort } = await searchParams
  const q = rawQ?.trim() ?? ""
  const sortTop = rawSort === "top"

  const supabase = await createClient()
  const [
    threadsRaw,
    {
      data: { user },
    },
  ] = await Promise.all([getBoardTalkForumThreads(supabase, q), supabase.auth.getUser()])

  const threads = sortTop
    ? [...threadsRaw].sort(
        (a, b) =>
          b.likeCount - a.likeCount ||
          b.commentCount - a.commentCount ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    : threadsRaw

  return <BoardTalkForumsView threads={threads} searchQuery={q} isLoggedIn={!!user} />
}
