/**
 * Resolve DB tags (`section`, `category_id`) for a saved-search criteria snapshot.
 */

import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"
import { categoryIdForBrowseBoardType } from "@/lib/utils/board-type-from-category-id"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { USED_MAGAZINES_CATEGORY_ID } from "@/lib/magazine-listing-config"

const PEER_SECTION_CATEGORY_ID: Partial<Record<PeerListingSection, string>> = {
  fins: USED_FINS_CATEGORY_ID,
  wetsuits: USED_WETSUITS_CATEGORY_ID,
  boardbags: USED_BOARDBAGS_CATEGORY_ID,
  surfpacks: USED_SURFPACKS_CATEGORY_ID,
  leashes: USED_LEASHES_CATEGORY_ID,
  apparel: USED_APPAREL_CATEGORY_ID,
  accessories: USED_ACCESSORIES_CATEGORY_ID,
  magazines: USED_MAGAZINES_CATEGORY_ID,
}

/** Column value for `saved_searches.section` (`null` = any peer section). */
export function savedSearchSectionColumn(
  criteria: BoardSavedSearchCriteria,
): PeerListingSection | null {
  if (criteria.anySection) return null
  if (isPeerListingSection(criteria.section)) return criteria.section
  return "surfboards"
}

/**
 * Column value for `saved_searches.category_id`:
 * - peer sections → fixed marketplace category UUID
 * - surfboards with a single style/type → that board category UUID
 * - otherwise null (all boards / multi-style / any-section)
 */
export function savedSearchCategoryIdColumn(
  criteria: BoardSavedSearchCriteria,
): string | null {
  const section = savedSearchSectionColumn(criteria)
  if (section == null) return null

  const fixed = PEER_SECTION_CATEGORY_ID[section]
  if (fixed) return fixed

  if (section === "surfboards") {
    const styles =
      criteria.style && criteria.style.length > 0
        ? criteria.style
        : criteria.type && criteria.type !== "all"
          ? [criteria.type]
          : []
    if (styles.length === 1) {
      return categoryIdForBrowseBoardType(styles[0]) ?? null
    }
  }

  return null
}
