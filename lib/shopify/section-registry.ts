import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"

export type ShopifySectionRegistryEntry = {
  section: PeerListingSection
  categoryId: string
  /** Column on `listings` for type-specific size slug, if any. */
  sizeColumn:
    | "fin_size"
    | "wetsuit_size"
    | "boardbag_size"
    | "surfpack_size"
    | "leash_size"
    | "apparel_size"
    | "accessory_size"
    | null
  /** Extra surfboard-only fields when section is surfboards. */
  boardType?: string
}

export const SHOPIFY_SECTION_REGISTRY: Record<PeerListingSection, ShopifySectionRegistryEntry> = {
  surfboards: {
    section: "surfboards",
    categoryId: boardCategoryMap.other,
    sizeColumn: null,
    boardType: "other",
  },
  fins: {
    section: "fins",
    categoryId: USED_FINS_CATEGORY_ID,
    sizeColumn: "fin_size",
  },
  wetsuits: {
    section: "wetsuits",
    categoryId: USED_WETSUITS_CATEGORY_ID,
    sizeColumn: "wetsuit_size",
  },
  boardbags: {
    section: "boardbags",
    categoryId: USED_BOARDBAGS_CATEGORY_ID,
    sizeColumn: "boardbag_size",
  },
  surfpacks: {
    section: "surfpacks",
    categoryId: USED_SURFPACKS_CATEGORY_ID,
    sizeColumn: "surfpack_size",
  },
  leashes: {
    section: "leashes",
    categoryId: USED_LEASHES_CATEGORY_ID,
    sizeColumn: "leash_size",
  },
  apparel: {
    section: "apparel",
    categoryId: USED_APPAREL_CATEGORY_ID,
    sizeColumn: "apparel_size",
  },
  accessories: {
    section: "accessories",
    categoryId: USED_ACCESSORIES_CATEGORY_ID,
    sizeColumn: "accessory_size",
  },
}

export function isPeerListingSectionValue(value: string): value is PeerListingSection {
  return (PEER_LISTING_SECTIONS as readonly string[]).includes(value)
}

export function shopifySectionRegistryEntry(
  section: PeerListingSection,
): ShopifySectionRegistryEntry {
  return SHOPIFY_SECTION_REGISTRY[section]
}
