/**
 * Peer-to-peer marketplace sections — listings sold directly between surfers
 * through the shared commerce pipeline (cart, checkout, offers, messaging).
 *
 * Surfboards, fins, and the accessory types (wetsuits, boardbags, surfpacks,
 * leashes, apparel, accessories) all flow through this pipeline; `new` (retail
 * catalog) does not. Use these helpers anywhere commerce code previously
 * hard-coded `section === "surfboards"` so new peer product types stay in sync.
 */

export const PEER_LISTING_SECTIONS = [
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
  "magazines",
] as const

export type PeerListingSection = (typeof PEER_LISTING_SECTIONS)[number]

const PEER_LISTING_SECTION_SET = new Set<string>(PEER_LISTING_SECTIONS)

export function isPeerListingSection(
  section: string | null | undefined,
): section is PeerListingSection {
  return section != null && PEER_LISTING_SECTION_SET.has(section)
}

/** Dedicated /sell sub-flow routes for peer sections. */
const PEER_SELL_ROUTE_BY_SECTION: Partial<Record<PeerListingSection, string>> = {
  surfboards: "/sell/boards",
  fins: "/sell/fins",
  wetsuits: "/sell/wetsuits",
  boardbags: "/sell/boardbags",
  surfpacks: "/sell/surfpacks",
  leashes: "/sell/leashes",
  apparel: "/sell/apparel",
  accessories: "/sell/accessories",
  magazines: "/sell/magazines",
}

export const PEER_LISTING_SECTION_LABELS: Record<PeerListingSection, string> = {
  surfboards: "Surfboard",
  fins: "Fins",
  wetsuits: "Wetsuit",
  boardbags: "Boardbag",
  surfpacks: "Surfpack",
  leashes: "Leash",
  apparel: "Apparel",
  accessories: "Accessories",
  magazines: "Magazine",
}

/** Sell-flow entry URL for admin bulk listing (includes `bulk` slot id). */
export function peerSellCreateHref(section: PeerListingSection, bulkSlotId: string): string {
  const bulk = `bulk=${encodeURIComponent(bulkSlotId)}`
  const base = PEER_SELL_ROUTE_BY_SECTION[section] ?? "/sell/boards"
  if (section === "fins") {
    return `${base}?step=search&${bulk}`
  }
  return `${base}?${bulk}`
}

/** Owner edit URL for a peer listing on the listing detail page. */
export function peerListingEditHref(
  section: string | null | undefined,
  listingId: string,
): string {
  if (isPeerListingSection(section) && PEER_SELL_ROUTE_BY_SECTION[section]) {
    return `${PEER_SELL_ROUTE_BY_SECTION[section]}?edit=${listingId}`
  }
  return `/sell?edit=${listingId}`
}

/** Mutable copy for Supabase `.in("section", …)` filters. */
export const PEER_LISTING_SECTIONS_FILTER: string[] = [...PEER_LISTING_SECTIONS]
