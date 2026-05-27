import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkForumsView } from "@/components/features/forum/board-talk-forums-view"
import { getBoardTalkForumThreads } from "@/lib/services/forumThreads"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Board Talk — Reswell",
  description: "Community posts, Q&A, and surfboard discussions — join the conversation.",
  path: "/board-talk",
})

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
