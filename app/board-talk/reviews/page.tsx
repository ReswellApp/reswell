import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { BoardTalkReviewsView } from "@/components/features/forum/board-talk-reviews-view"
import { getBoardTalkReviewFeed } from "@/lib/services/boardTalkReviews"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Board Reviews — Board Talk · Reswell",
  description: "Community ratings and reviews for surfboard models in the Reswell catalog.",
  path: "/board-talk/reviews",
})

export default async function BoardTalkReviewsPage() {
  const supabase = await createClient()
  const reviews = await getBoardTalkReviewFeed(supabase, 50)

  return <BoardTalkReviewsView reviews={reviews} />
}
