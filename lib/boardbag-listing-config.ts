/**
 * Single source of truth for the boardbag marketplace product type.
 *
 * Boardbags are stored as `listings` rows with `section = 'boardbags'`. The
 * boardbag-specific size lives in the `boardbag_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell boardbags flow, the /boardbags browse filters, the
 * boardbags PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const BOARDBAGS_SECTION = "boardbags" as const

/**
 * Fixed `categories.id` for peer-to-peer boardbags. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every boardbag listing references this row.
 */
export const USED_BOARDBAGS_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000003"

export type BoardbagFacetOption = { value: string; label: string }

/** Boardbag size — stored as a slug in `listings.boardbag_size`. */
export const BOARDBAG_SIZE_OPTIONS: readonly BoardbagFacetOption[] = []

const BOARDBAG_SIZE_SLUGS = new Set(BOARDBAG_SIZE_OPTIONS.map((o) => o.value))

export function isBoardbagSizeSlug(value: string): boolean {
  return BOARDBAG_SIZE_SLUGS.has(value)
}

const BOARDBAG_SIZE_LABELS = labelMap(BOARDBAG_SIZE_OPTIONS)

function labelMap(options: readonly BoardbagFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function boardbagSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return BOARDBAG_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function boardbagSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isBoardbagSizeSlug(v) ? v : null
}
