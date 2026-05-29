import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkReviewsView } from "@/components/features/forum/board-talk-reviews-view"
import { getBoardTalkReviewFeed } from "@/lib/services/boardTalkReviews"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("board-talk-reviews")
}

export default async function BoardTalkReviewsPage() {
  const supabase = await createClient()
  const reviews = await getBoardTalkReviewFeed(supabase, 50)

  return <BoardTalkReviewsView reviews={reviews} />
}
