import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkForumsView } from "@/components/features/forum/board-talk-forums-view"
import { getBoardTalkForumThreads } from "@/lib/services/forumThreads"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("board-talk")
}

export default async function BoardTalkForumsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q: rawQ } = await searchParams
  const q = rawQ?.trim() ?? ""

  const supabase = await createClient()
  const [
    threads,
    {
      data: { user },
    },
  ] = await Promise.all([getBoardTalkForumThreads(supabase, q), supabase.auth.getUser()])

  return <BoardTalkForumsView threads={threads} searchQuery={q} isLoggedIn={!!user} />
}
