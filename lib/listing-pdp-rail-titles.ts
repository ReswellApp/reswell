/** Nouns used in the `/l` horizontal-rail headings. */
const SECTION_NOUN: Record<string, string> = {
  surfboards: "boards",
  fins: "fins",
  traction: "traction",
  wetsuits: "wetsuits",
  apparel: "apparel",
  magazines: "magazines",
  boardbags: "boardbags",
  leashes: "leashes",
  surfpacks: "surfpacks",
  accessories: "accessories",
}

function noun(section: string): string {
  return SECTION_NOUN[section] ?? section
}

/** “Similar boards” and the matching heading on every other peer PDP. */
export function similarListingRailTitle(section: string): string {
  return `Similar ${noun(section)}`
}

/** “More boards from this seller” and the matching heading on every other peer PDP. */
export function sellerListingRailTitle(section: string): string {
  return `More ${noun(section)} from this seller`
}

export const RECENTLY_VIEWED_RAIL_TITLE = "Recently viewed"
export const SHOP_RELATED_RAIL_TITLE = "You may also like"
