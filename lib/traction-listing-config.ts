/**
 * Single source of truth for the traction marketplace product type.
 *
 * Traction is stored as `listings` rows with `section = 'traction'`. The
 * traction type lives in the `traction_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell traction flow, the /traction browse filters, the
 * traction PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/leash-listing-config.ts`.
 */

export const TRACTION_SECTION = "traction" as const

/**
 * Fixed `categories.id` for peer-to-peer traction. Must match the seed in
 * migration `20270915120000_traction_marketplace.sql`. `listings.category_id` is
 * NOT NULL, so every traction listing references this row.
 */
export const USED_TRACTION_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000009"

export type TractionFacetOption = { value: string; label: string }

/** Traction type — stored as a slug in `listings.traction_size`. */
export const TRACTION_SIZE_OPTIONS: readonly TractionFacetOption[] = [
  { value: "tail_pad", label: "Tail pad" },
  { value: "front_pad", label: "Front pad" },
  { value: "deck_pad", label: "Deck pad" },
  { value: "kit", label: "Kit" },
  { value: "other", label: "Other" },
]

const TRACTION_SIZE_SLUGS = new Set(TRACTION_SIZE_OPTIONS.map((o) => o.value))

export function isTractionSizeSlug(value: string): boolean {
  return TRACTION_SIZE_SLUGS.has(value)
}

const TRACTION_SIZE_LABELS = labelMap(TRACTION_SIZE_OPTIONS)

function labelMap(options: readonly TractionFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function tractionSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return TRACTION_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function tractionSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isTractionSizeSlug(v) ? v : null
}
