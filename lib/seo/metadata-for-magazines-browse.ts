import "server-only"
import type { Metadata } from "next"
import { magazinesBrowseIndexableSnapshot } from "@/lib/magazines-browse-metadata"

export async function metadataForMagazinesBrowse(): Promise<Metadata> {
  const { title, description, canonicalUrl } = magazinesBrowseIndexableSnapshot()

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}
