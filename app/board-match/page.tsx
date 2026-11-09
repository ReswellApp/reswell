import { BoardMatchPage } from "@/components/features/board-match/board-match-page"
import { loadBoardMatchDeck } from "@/lib/services/boardMatch"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { getDb } from "@/lib/supabase/db"

export const revalidate = 3600

export async function generateMetadata() {
  return resolvePageMetadata("board-match")
}

export default async function BoardMatchRoutePage() {
  const supabase = getDb({ consistency: "eventual" })
  const deck = await loadBoardMatchDeck(supabase)

  return <BoardMatchPage initialCards={deck.cards} unavailable={deck.unavailable} />
}
