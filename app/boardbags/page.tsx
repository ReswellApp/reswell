import type { Metadata } from "next"
import { BoardbagsBrowsePage } from "@/components/boardbags-browse-page"
import type { BoardbagsBrowseSearchParams } from "@/lib/boardbags-browse-metadata"
import { metadataForBoardbagsBrowse } from "@/lib/seo/metadata-for-boardbags-browse"

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
  return await metadataForBoardbagsBrowse(flat as BoardbagsBrowseSearchParams)
}

export default function BoardbagsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <BoardbagsBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as BoardbagsBrowseSearchParams,
      )}
    />
  )
}
