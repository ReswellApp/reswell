import { BoardFinderPage } from "@/components/features/board-finder/board-finder-page"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("board-finder")
}

export default function BoardFinderRoutePage() {
  return <BoardFinderPage />
}
