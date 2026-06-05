import type { Metadata } from "next"
import { ApparelBrowsePage } from "@/components/apparel-browse-page"
import type { ApparelBrowseSearchParams } from "@/lib/apparel-browse-metadata"
import { metadataForApparelBrowse } from "@/lib/seo/metadata-for-apparel-browse"

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
  return await metadataForApparelBrowse(flat as ApparelBrowseSearchParams)
}

export default function ApparelPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <ApparelBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as ApparelBrowseSearchParams,
      )}
    />
  )
}
