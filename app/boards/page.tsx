import type { Metadata } from "next"
import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { BOARDS_BROWSE_REVALIDATE_SECONDS } from "@/lib/cache/boards-browse-catalog"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import { metadataForBoardsBrowse } from "@/lib/seo/metadata-for-boards-browse"

/** ISR for `/boards` — keep in sync with `BOARDS_BROWSE_REVALIDATE_SECONDS`. */
export const revalidate = BOARDS_BROWSE_REVALIDATE_SECONDS

function flattenSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    o[k] = Array.isArray(v) ? v[0] : v
  }
  return o
}

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const flat = flattenSearchParams(await props.searchParams)
  return await metadataForBoardsBrowse(flat as BoardsBrowseSearchParams)
}

export default function BoardsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <BoardsBrowsePage
      searchParams={props.searchParams.then((sp) => flattenSearchParams(sp) as BoardsBrowseSearchParams)}
    />
  )
}
