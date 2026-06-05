/**
 * Peer-to-peer marketplace sections — listings sold directly between surfers
 * through the shared commerce pipeline (cart, checkout, offers, messaging).
 *
 * Surfboards and fins both flow through this pipeline; `new` (retail catalog)
 * does not. Use these helpers anywhere commerce code previously hard-coded
 * `section === "surfboards"` so new peer product types stay in sync.
 */

export const PEER_LISTING_SECTIONS = ["surfboards", "fins"] as const

export type PeerListingSection = (typeof PEER_LISTING_SECTIONS)[number]

export function isPeerListingSection(
  section: string | null | undefined,
): section is PeerListingSection {
  return section === "surfboards" || section === "fins"
}

/** Mutable copy for Supabase `.in("section", …)` filters. */
export const PEER_LISTING_SECTIONS_FILTER: string[] = [...PEER_LISTING_SECTIONS]
