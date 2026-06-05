import type { Metadata } from "next"
import { LeashesBrowsePage } from "@/components/leashes-browse-page"
import type { LeashesBrowseSearchParams } from "@/lib/leashes-browse-metadata"
import { metadataForLeashesBrowse } from "@/lib/seo/metadata-for-leashes-browse"

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
  return await metadataForLeashesBrowse(flat as LeashesBrowseSearchParams)
}

export default function LeashesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <LeashesBrowsePage
      searchParams={props.searchParams.then(
        (sp) => flattenSearchParams(sp) as LeashesBrowseSearchParams,
      )}
    />
  )
}
