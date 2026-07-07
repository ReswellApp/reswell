import { publicSiteOrigin } from "@/lib/public-site-origin"

export const MAGAZINES_BROWSE_DEFAULT_SORT = "newest" as const

export const magazinesBrowseRootLabel = "Magazines"

export type MagazinesBrowseSearchParams = {
  page?: string
}

export function magazinesBrowseHeroSubtext(): string {
  return "Vintage and collectible surf magazines — shipped from Reswell."
}

export function magazinesBrowseIndexableSnapshot(): {
  title: string
  description: string
  canonicalUrl: string
} {
  const title = "Surf Magazines For Sale | Reswell"
  const description =
    "Browse surf magazines and media for sale on Reswell. Vintage issues, collector editions, and more — shipped to your door."
  const canonicalUrl = new URL("/magazines", publicSiteOrigin() + "/").toString()
  return { title, description, canonicalUrl }
}
