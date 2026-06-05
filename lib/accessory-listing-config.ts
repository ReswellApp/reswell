/**
 * Single source of truth for the accessory marketplace product type.
 *
 * Accessories are stored as `listings` rows with `section = 'accessories'`. The
 * accessory-specific size lives in the `accessory_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell accessories flow, the /accessories browse filters, the
 * accessories PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const ACCESSORIES_SECTION = "accessories" as const

/**
 * Fixed `categories.id` for peer-to-peer accessories. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every accessory listing references this row.
 */
export const USED_ACCESSORIES_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000007"

export type AccessoryFacetOption = { value: string; label: string }

/** Accessory size — stored as a slug in `listings.accessory_size`. */
export const ACCESSORY_SIZE_OPTIONS: readonly AccessoryFacetOption[] = []

const ACCESSORY_SIZE_SLUGS = new Set(ACCESSORY_SIZE_OPTIONS.map((o) => o.value))

export function isAccessorySizeSlug(value: string): boolean {
  return ACCESSORY_SIZE_SLUGS.has(value)
}

const ACCESSORY_SIZE_LABELS = labelMap(ACCESSORY_SIZE_OPTIONS)

function labelMap(options: readonly AccessoryFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function accessorySizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return ACCESSORY_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function accessorySizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isAccessorySizeSlug(v) ? v : null
}
