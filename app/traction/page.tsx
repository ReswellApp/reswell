import type { Metadata } from "next"
import { TractionBrowsePage } from "@/components/traction-browse-page"
import type { TractionBrowseSearchParams } from "@/lib/traction-browse-metadata"
import { metadataForTractionBrowse } from "@/lib/seo/metadata-for-traction-browse"

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
  return await metadataForTractionBrowse(flat as TractionBrowseSearchParams)
}

export default function TractionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <TractionBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as TractionBrowseSearchParams,
      )}
    />
  )
}
