import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { MARKETPLACE_BRAND_SYNONYM_GROUPS } from "@/lib/utils/marketplace-brand-synonyms"

/** Generic words sellers append to a shaper name. They are not the brand. */
const BRAND_NOISE_WORDS = new Set(["surfboard", "surfboards", "board", "boards", "surf"])

/** Connectors inside an alias phrase ("Lost by Mayhem"), not part of the name. */
const BRAND_CONNECTORS = new Set(["by", "and", "the"])

/** Shorter than this, a fragment is only an exact compact label ("ci"), never a substring. */
const MIN_WORD_LEN = 3

/**
 * Lowercase, strip diacritics and punctuation, and drop generic product words.
 * "Channel Islands Surfboards" and "channel-islands" both become "channel islands".
 */
export function savedSearchLabelPhrase(raw: string | null | undefined): string {
  const folded = (raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
  const tokens = folded
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !BRAND_NOISE_WORDS.has(token))
  return tokens.join(" ")
}

function phraseContains(haystack: string, needle: string): boolean {
  if (needle.length < MIN_WORD_LEN || !haystack) return false
  return haystack === needle || ` ${haystack} `.includes(` ${needle} `)
}

/**
 * The whole label is one built-in synonym group (Lost ↔ Mayhem).
 * A longer name that only contains an alias token ("Lost Coast") does not qualify.
 */
function synonymGroupForPhrase(phrase: string): readonly string[] | null {
  const tokens = phrase.split(" ").filter((token) => token && !BRAND_CONNECTORS.has(token))
  if (tokens.length === 0) return null
  for (const group of MARKETPLACE_BRAND_SYNONYM_GROUPS) {
    const names = new Set(group)
    if (tokens.every((token) => names.has(token))) return group
  }
  return null
}

function isChannelIslandsLabel(raw: string | null | undefined): boolean {
  const phrase = savedSearchLabelPhrase(raw)
  if (!phrase) return false
  const compact = compactSearchKey(phrase)
  return compact === "ci" || phrase === "ci" || compact === "channelislands" || phrase === "channel islands"
}

/**
 * Freeform text match for a saved brand or model.
 * Whole words, or the same letters with spaces and punctuation removed
 * ("neckbeard" ↔ "Neck Beard"). "al" does not match "Album".
 */
export function savedSearchTextMatches(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const wanted = (needle ?? "").trim()
  if (!wanted) return true
  const right = savedSearchLabelPhrase(wanted)
  if (!right) return true
  const left = savedSearchLabelPhrase(haystack)
  if (!left) return false
  if (phraseContains(left, right)) return true
  const compactLeft = compactSearchKey(left)
  const compactRight = compactSearchKey(right)
  return compactRight.length >= 2 && compactLeft === compactRight
}

/** Brand text, plus Lost ↔ Mayhem and CI ↔ Channel Islands. */
export function savedSearchBrandTextsMatch(
  listingBrand: string | null | undefined,
  criteriaBrand: string | null | undefined,
): boolean {
  const wanted = (criteriaBrand ?? "").trim()
  if (!wanted) return true
  if (savedSearchTextMatches(listingBrand, wanted)) return true
  const wantedGroup = synonymGroupForPhrase(savedSearchLabelPhrase(wanted))
  const listingGroup = synonymGroupForPhrase(savedSearchLabelPhrase(listingBrand))
  if (wantedGroup && listingGroup && wantedGroup === listingGroup) return true
  return isChannelIslandsLabel(wanted) && isChannelIslandsLabel(listingBrand)
}

/** Labels to OR into a brand query so a known alias recalls the same shaper. */
export function savedSearchBrandAliasLabels(brand: string | null | undefined): string[] {
  const phrase = savedSearchLabelPhrase(brand)
  if (!phrase) return []
  const aliases = new Set<string>()
  const group = synonymGroupForPhrase(phrase)
  if (group) {
    for (const alias of group) aliases.add(alias)
  }
  if (isChannelIslandsLabel(brand)) {
    aliases.add(compactSearchKey(phrase) === "ci" ? "channel islands" : "ci")
  }
  aliases.delete(phrase)
  return [...aliases]
}
