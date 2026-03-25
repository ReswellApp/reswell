import type { BrandProfile, DirectoryListEntry } from "@/lib/index-directory/types"
import channelIslandsData from "@/lib/index-directory/data/channel-islands.json"
import lovelaceMachineData from "@/lib/index-directory/data/lovelace-machine.json"
import sharpeyeSurfboardsData from "@/lib/index-directory/data/sharpeye-surfboards.json"

const channelIslands = channelIslandsData as BrandProfile
const lovelaceMachine = lovelaceMachineData as BrandProfile
const sharpeyeSurfboards = sharpeyeSurfboardsData as BrandProfile

const BRAND_BY_SLUG: Record<string, BrandProfile> = {
  [channelIslands.slug]: channelIslands,
  [lovelaceMachine.slug]: lovelaceMachine,
  [sharpeyeSurfboards.slug]: sharpeyeSurfboards,
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
    {
      slug: lovelaceMachine.slug,
      kind: "brand",
      name: lovelaceMachine.name,
      shortDescription: lovelaceMachine.shortDescription,
      logoUrl: lovelaceMachine.logoUrl,
      locationLabel: lovelaceMachine.locationLabel,
      modelCount: lovelaceMachine.models.length,
    },
    {
      slug: sharpeyeSurfboards.slug,
      kind: "brand",
      name: sharpeyeSurfboards.name,
      shortDescription: sharpeyeSurfboards.shortDescription,
      logoUrl: sharpeyeSurfboards.logoUrl,
      locationLabel: sharpeyeSurfboards.locationLabel,
      modelCount: sharpeyeSurfboards.models.length,
    },
  ]
}
