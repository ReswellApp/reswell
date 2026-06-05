/**
 * Single source of truth for the surfpack marketplace product type.
 *
 * Surfpacks are stored as `listings` rows with `section = 'surfpacks'`. The
 * surfpack-specific size lives in the `surfpack_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell surfpacks flow, the /surfpacks browse filters, the
 * surfpacks PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const SURFPACKS_SECTION = "surfpacks" as const

/**
 * Fixed `categories.id` for peer-to-peer surfpacks. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every surfpack listing references this row.
 */
export const USED_SURFPACKS_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000004"

export type SurfpackFacetOption = { value: string; label: string }

/** Surfpack size — stored as a slug in `listings.surfpack_size`. */
export const SURFPACK_SIZE_OPTIONS: readonly SurfpackFacetOption[] = []

const SURFPACK_SIZE_SLUGS = new Set(SURFPACK_SIZE_OPTIONS.map((o) => o.value))

export function isSurfpackSizeSlug(value: string): boolean {
  return SURFPACK_SIZE_SLUGS.has(value)
}

const SURFPACK_SIZE_LABELS = labelMap(SURFPACK_SIZE_OPTIONS)

function labelMap(options: readonly SurfpackFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function surfpackSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return SURFPACK_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function surfpackSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isSurfpackSizeSlug(v) ? v : null
}
