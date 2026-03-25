import type { BrandProfile, DirectoryListEntry } from "@/lib/index-directory/types"
import channelIslandsData from "@/lib/index-directory/data/channel-islands.json"

const channelIslands = channelIslandsData as BrandProfile

const BRAND_BY_SLUG: Record<string, BrandProfile> = {
  [channelIslands.slug]: channelIslands,
}

export function getBrandProfileBySlug(slug: string): BrandProfile | undefined {
  return BRAND_BY_SLUG[slug]
}

export function getAllBrandSlugs(): string[] {
  return Object.keys(BRAND_BY_SLUG)
}

/** Cards shown on the Index directory — extend as you add profiles. */
export function getDirectoryListEntries(): DirectoryListEntry[] {
  return [
    {
      slug: channelIslands.slug,
      kind: "brand",
      name: channelIslands.name,
      shortDescription: channelIslands.shortDescription,
      logoUrl: channelIslands.logoUrl,
      locationLabel: channelIslands.locationLabel,
      modelCount: channelIslands.models.length,
    },
  ]
}
