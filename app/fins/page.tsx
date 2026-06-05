import type { Metadata } from "next"
import { FinsBrowsePage } from "@/components/fins-browse-page"
import type { FinsBrowseSearchParams } from "@/lib/fins-browse-metadata"
import { metadataForFinsBrowse } from "@/lib/seo/metadata-for-fins-browse"

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
  return await metadataForFinsBrowse(flat as FinsBrowseSearchParams)
}

export default function FinsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <FinsBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as FinsBrowseSearchParams,
      )}
    />
  )
}
