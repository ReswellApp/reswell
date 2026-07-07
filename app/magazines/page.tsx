import type { Metadata } from "next"
import { MagazinesBrowsePage } from "@/components/magazines-browse-page"
import type { MagazinesBrowseSearchParams } from "@/lib/magazines-browse-metadata"
import { metadataForMagazinesBrowse } from "@/lib/seo/metadata-for-magazines-browse"

export const dynamic = "force-dynamic"

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
  return await metadataForMagazinesBrowse(flat as MagazinesBrowseSearchParams)
}

export default function MagazinesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <MagazinesBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as MagazinesBrowseSearchParams,
      )}
    />
  )
}
