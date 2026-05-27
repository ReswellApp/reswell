import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkWhatsNewView } from "@/components/features/forum/board-talk-whats-new-view"
import { getBoardTalkWhatsNewFeed } from "@/lib/services/forumThreads"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "What's New — Board Talk · Reswell",
  description: "Fresh posts and replies from the Reswell Board Talk community.",
  path: "/board-talk/whats-new",
})

export default async function BoardTalkWhatsNewPage() {
  const supabase = await createClient()
  const items = await getBoardTalkWhatsNewFeed(supabase, 40)

  return <BoardTalkWhatsNewView items={items} />
}
