import { BoardMatchPage } from "@/components/features/board-match/board-match-page"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("board-match")
}

export default function BoardMatchRoutePage() {
  return <BoardMatchPage />
}
