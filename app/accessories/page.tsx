import type { Metadata } from "next"
import { AccessoriesBrowsePage } from "@/components/accessories-browse-page"
import type { AccessoriesBrowseSearchParams } from "@/lib/accessories-browse-metadata"
import { metadataForAccessoriesBrowse } from "@/lib/seo/metadata-for-accessories-browse"

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
  return await metadataForAccessoriesBrowse(flat as AccessoriesBrowseSearchParams)
}

export default function AccessoriesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <AccessoriesBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as AccessoriesBrowseSearchParams,
      )}
    />
  )
}
