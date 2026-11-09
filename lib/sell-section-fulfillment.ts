/** Surfboards are the only peer listing section that supports local pickup on `/sell`. */
export const SELL_SURFBOARDS_SECTION = "surfboards" as const

/** Sections whose website and mobile `/sell` flows are ship-only (same structure as `/sell/fins`). */
export const SELL_SHIP_ONLY_SECTIONS = new Set<string>([
  "fins",
  "wetsuits",
  "magazines",
  "apparel",
  "accessories",
  "traction",
  "boardbags",
  "surfpacks",
  "leashes",
])

export function sellSectionIsShipOnly(section: string | null | undefined): boolean {
  if (!section) return false
  return SELL_SHIP_ONLY_SECTIONS.has(section)
}

export function sellSectionSupportsLocalPickup(section: string | null | undefined): boolean {
  return section === SELL_SURFBOARDS_SECTION
}

export function sellShipOnlySectionDescription(productNoun: string): string {
  return `Pin where you're shipping from and choose how shipping works. ${productNoun} listings ship only — local pickup isn't available.`
}
