import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { metadataForBoardsBrowse, type BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"

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
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { slug } = await props.params
  const rawSp = await props.searchParams
  const flat = flattenSearchParams(rawSp)

  if (slug === "boards") {
    return await metadataForBoardsBrowse(flat as BoardsBrowseSearchParams)
  }

  notFound()
}

export default async function MarketplaceSlugPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await props.params

  if (slug === "boards") {
    return (
      <BoardsBrowsePage
        searchParams={props.searchParams.then((sp) => flattenSearchParams(sp) as BoardsBrowseSearchParams)}
      />
    )
  }

  notFound()
}
