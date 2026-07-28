import {
  isPeerListingSection,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"

/** Conversational singular/plural for peer checkout & commerce copy. */
export type PeerItemNounForm = {
  singular: string
  plural: string
}

/** Matches `CheckoutCopy` in checkout UI — kept here to avoid lib → components imports. */
export type PeerCheckoutCopy = {
  itemLineLabel: string
  inspectNoun: string
  priceContextNoun: string
}

const SECTION_ITEM_NOUNS: Record<PeerListingSection, PeerItemNounForm> = {
  surfboards: { singular: "board", plural: "boards" },
  fins: { singular: "fin", plural: "fins" },
  wetsuits: { singular: "wetsuit", plural: "wetsuits" },
  boardbags: { singular: "boardbag", plural: "boardbags" },
  surfpacks: { singular: "surfpack", plural: "surfpacks" },
  leashes: { singular: "leash", plural: "leashes" },
  apparel: { singular: "item", plural: "items" },
  accessories: { singular: "accessory", plural: "accessories" },
  magazines: { singular: "magazine", plural: "magazines" },
}

const FALLBACK_NOUN: PeerItemNounForm = { singular: "item", plural: "items" }

function capitalizeWord(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Noun pair for a single listing section (unknown → item/items). */
export function peerListingItemNounForm(
  section: string | null | undefined,
): PeerItemNounForm {
  if (isPeerListingSection(section)) return SECTION_ITEM_NOUNS[section]
  return FALLBACK_NOUN
}

/**
 * Resolve a noun pair for one or more listings.
 * Mixed or unknown sections fall back to item/items.
 */
export function peerListingsItemNounForm(
  sections: Array<string | null | undefined>,
): PeerItemNounForm {
  const peerSections = sections.filter(isPeerListingSection)
  if (peerSections.length === 0) return FALLBACK_NOUN

  const unique = new Set(peerSections)
  if (unique.size !== 1) return FALLBACK_NOUN

  return SECTION_ITEM_NOUNS[peerSections[0]!]
}

/** "board" / "boards" / "2 boards" / "2 items" depending on count + sections. */
export function formatPeerItemCountPhrase(
  count: number,
  sections: Array<string | null | undefined>,
): string {
  const n = Math.max(0, Math.floor(count))
  const { singular, plural } = peerListingsItemNounForm(sections)
  if (n === 1) return singular
  return `${n} ${plural}`
}

/** "your board" / "your items" — uses plural form when count !== 1. */
export function formatPeerPossessiveItemPhrase(
  count: number,
  sections: Array<string | null | undefined>,
): string {
  const n = Math.max(0, Math.floor(count))
  const { singular, plural } = peerListingsItemNounForm(sections)
  return n === 1 ? `your ${singular}` : `your ${plural}`
}

/** Checkout line-label overrides derived from the listings in the order. */
export function peerCheckoutCopyFromSections(
  sections: Array<string | null | undefined>,
  count: number,
): PeerCheckoutCopy {
  const { singular, plural } = peerListingsItemNounForm(sections)
  const isBundle = count > 1
  return {
    itemLineLabel: capitalizeWord(isBundle ? plural : singular),
    inspectNoun: isBundle ? plural : singular,
    priceContextNoun: isBundle ? "bundle" : singular,
  }
}
