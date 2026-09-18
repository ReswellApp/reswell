/**
 * Admin-curated keywords on `listings.search_tags`.
 * Stored as a Postgres text[] of lowercase slugs.
 *
 * Preset slugs match board styles so tagging "fish" includes the listing in
 * `/boards?type=fish` and "fish" marketplace search, without rewriting `board_type`.
 */

import { canonicalListingsBoardTypeKey } from "./board-type-canonical.ts"

export const LISTING_SEARCH_TAG_MAX = 12
export const LISTING_SEARCH_TAG_MAX_LENGTH = 32

/** Fish first — the tag ops will use most. Then the remaining board styles. */
export const LISTING_SEARCH_TAG_PRESETS: readonly { value: string; label: string }[] = [
  { value: "fish", label: "Fish" },
  { value: "shortboard", label: "Shortboard" },
  { value: "groveler", label: "Groveler" },
  { value: "asym", label: "Asym" },
  { value: "hybrid", label: "Hybrid / Mid-Length" },
  { value: "longboard", label: "Longboard" },
  { value: "step-up-gun", label: "Step-Up / Gun" },
  { value: "other", label: "Other" },
]

const PRESET_BY_VALUE = new Map(LISTING_SEARCH_TAG_PRESETS.map((o) => [o.value, o.label]))

const TAG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeListingSearchTag(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function isListingSearchTagSlug(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= LISTING_SEARCH_TAG_MAX_LENGTH &&
    TAG_SLUG_RE.test(value)
  )
}

export function listingSearchTagLabel(slug: string): string {
  return PRESET_BY_VALUE.get(slug) ?? slug.replace(/-/g, " ")
}

function pushUniqueTag(out: string[], seen: Set<string>, raw: unknown): void {
  if (typeof raw !== "string") return
  const slug = normalizeListingSearchTag(raw)
  if (!isListingSearchTagSlug(slug) || seen.has(slug)) return
  seen.add(slug)
  out.push(slug)
}

/** Accepts a Postgres text[], comma list, or single slug. */
export function parseListingSearchTags(raw: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(raw)) {
    for (const part of raw) pushUniqueTag(out, seen, part)
    return out
  }
  if (typeof raw !== "string") return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  for (const part of trimmed.split(",")) pushUniqueTag(out, seen, part)
  return out
}

export function serializeListingSearchTags(tags: readonly string[]): string[] {
  return parseListingSearchTags([...tags]).slice(0, LISTING_SEARCH_TAG_MAX)
}

/** Canonical style slugs that should also match `search_tags` in browse/search filters. */
export function listingSearchTagSlugsForStyles(styleSlugs: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of styleSlugs) {
    const canonical = canonicalListingsBoardTypeKey(raw)
    if (!canonical || seen.has(canonical)) continue
    seen.add(canonical)
    out.push(canonical)
  }
  return out
}

/** PostgREST `or=` fragment: `search_tags && ARRAY[…]`. */
export function listingSearchTagsOverlapOrPart(styleSlugs: readonly string[]): string | null {
  const tags = listingSearchTagSlugsForStyles(styleSlugs)
  if (tags.length === 0) return null
  if (!tags.every((tag) => TAG_SLUG_RE.test(tag))) return null
  return `search_tags.ov.{${tags.join(",")}}`
}
