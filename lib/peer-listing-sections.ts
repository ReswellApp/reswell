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
] as const

export type PeerListingSection = (typeof PEER_LISTING_SECTIONS)[number]

const PEER_LISTING_SECTION_SET = new Set<string>(PEER_LISTING_SECTIONS)

export function isPeerListingSection(
  section: string | null | undefined,
): section is PeerListingSection {
  return section != null && PEER_LISTING_SECTION_SET.has(section)
}

/** Dedicated /sell sub-flow routes for peer sections (surfboards use `/sell`). */
const PEER_SELL_ROUTE_BY_SECTION: Partial<Record<PeerListingSection, string>> = {
  fins: "/sell/fins",
  wetsuits: "/sell/wetsuits",
  boardbags: "/sell/boardbags",
  surfpacks: "/sell/surfpacks",
  leashes: "/sell/leashes",
  apparel: "/sell/apparel",
  accessories: "/sell/accessories",
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
