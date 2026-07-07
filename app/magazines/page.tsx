import type { Metadata } from "next"
import { MagazinesBrowsePage } from "@/components/magazines-browse-page"
import { metadataForMagazinesBrowse } from "@/lib/seo/metadata-for-magazines-browse"

export async function generateMetadata(): Promise<Metadata> {
  return metadataForMagazinesBrowse()
}

export default function MagazinesPage(props: {
  searchParams: Promise<{ page?: string }>
}) {
  return <MagazinesBrowsePage searchParams={props.searchParams} />
}
