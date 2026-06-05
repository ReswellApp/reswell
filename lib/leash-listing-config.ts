/**
 * Single source of truth for the leash marketplace product type.
 *
 * Leashes are stored as `listings` rows with `section = 'leashes'`. The
 * leash-specific size lives in the `leash_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell leashes flow, the /leashes browse filters, the
 * leashes PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const LEASHES_SECTION = "leashes" as const

/**
 * Fixed `categories.id` for peer-to-peer leashes. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every leash listing references this row.
 */
export const USED_LEASHES_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000005"

export type LeashFacetOption = { value: string; label: string }

/** Leash size — stored as a slug in `listings.leash_size`. */
export const LEASH_SIZE_OPTIONS: readonly LeashFacetOption[] = []

const LEASH_SIZE_SLUGS = new Set(LEASH_SIZE_OPTIONS.map((o) => o.value))

export function isLeashSizeSlug(value: string): boolean {
  return LEASH_SIZE_SLUGS.has(value)
}

const LEASH_SIZE_LABELS = labelMap(LEASH_SIZE_OPTIONS)

function labelMap(options: readonly LeashFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function leashSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return LEASH_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function leashSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isLeashSizeSlug(v) ? v : null
}
