import { isPeerListingSection } from "@/lib/peer-listing-sections"

/** Validates peer section slugs for seller shop category filters. */
export function resolveProfileShopSectionFilter(section: string | undefined): string | undefined {
  const trimmed = section?.trim()
  if (!trimmed) return undefined
  return isPeerListingSection(trimmed) ? trimmed : undefined
}
