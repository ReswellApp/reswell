import type { Metadata } from "next"
import { WetsuitsBrowsePage } from "@/components/wetsuits-browse-page"
import type { WetsuitsBrowseSearchParams } from "@/lib/wetsuits-browse-metadata"
import { metadataForWetsuitsBrowse } from "@/lib/seo/metadata-for-wetsuits-browse"

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
  return await metadataForWetsuitsBrowse(flat as WetsuitsBrowseSearchParams)
}

export default function WetsuitsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <WetsuitsBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as WetsuitsBrowseSearchParams,
      )}
    />
  )
}
