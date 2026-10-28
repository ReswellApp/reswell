import {
  mobileProfileShopFiltersSchema,
  type MobileProfileShopFilters,
} from "@reswell/api-contract"
import { fetchMobileProfileShopSectionCounts } from "@/lib/db/mobile-profile-shop"
import { isPeerListingSection, sellerProfileSectionSortRank } from "@/lib/peer-listing-sections"
import { resolveProfileShopSectionFilter } from "@/lib/sellers/profile-shop-section-filter"
import { loadPublicMobileProfileRow } from "@/lib/services/mobileApi"
import type { MobileApiResult } from "@/lib/services/mobileApi"

function formatSellerShopSectionLabel(section: string): string {
  return section.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

export async function getMobileProfileShopFiltersService(
  slug: string,
  status: "current" | "sold",
): Promise<MobileApiResult<MobileProfileShopFilters>> {
  const profile = await loadPublicMobileProfileRow(slug)
  if (!profile.ok) return profile

  const counted = await fetchMobileProfileShopSectionCounts(profile.data.id, status)
  if (!counted.ok) {
    console.error("[mobile-api] profile shop filters failed", {
      timestamp: new Date().toISOString(),
      message: counted.message,
    })
    return { ok: false, status: 500, error: "Unable to load shop filters right now" }
  }

  const sections = counted.rows
    .filter((row) => isPeerListingSection(row.section))
    .sort((a, b) => {
      const rank = sellerProfileSectionSortRank(a.section) - sellerProfileSectionSortRank(b.section)
      if (rank !== 0) return rank
      return a.section.localeCompare(b.section)
    })
    .map((row) => ({
      id: row.section,
      label: formatSellerShopSectionLabel(row.section),
      count: row.count,
    }))

  const parsed = mobileProfileShopFiltersSchema.safeParse({ sections, status })
  if (!parsed.success) {
    return { ok: false, status: 500, error: "Unable to load shop filters right now" }
  }
  return { ok: true, data: parsed.data }
}
