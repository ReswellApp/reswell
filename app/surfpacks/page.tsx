import type { Metadata } from "next"
import { SurfpacksBrowsePage } from "@/components/surfpacks-browse-page"
import type { SurfpacksBrowseSearchParams } from "@/lib/surfpacks-browse-metadata"
import { metadataForSurfpacksBrowse } from "@/lib/seo/metadata-for-surfpacks-browse"

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
  return await metadataForSurfpacksBrowse(flat as SurfpacksBrowseSearchParams)
}

export default function SurfpacksPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <SurfpacksBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as SurfpacksBrowseSearchParams,
      )}
    />
  )
}
