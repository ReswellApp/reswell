/**
 * Single source of truth for the apparel marketplace product type.
 *
 * Apparel are stored as `listings` rows with `section = 'apparel'`. The
 * apparel-specific size lives in the `apparel_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell apparel flow, the /apparel browse filters, the
 * apparel PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const APPAREL_SECTION = "apparel" as const

/**
 * Fixed `categories.id` for peer-to-peer apparel. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every apparel listing references this row.
 */
export const USED_APPAREL_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000006"

export type ApparelFacetOption = { value: string; label: string }

/** Apparel size — stored as a slug in `listings.apparel_size`. */
export const APPAREL_SIZE_OPTIONS: readonly ApparelFacetOption[] = []

const APPAREL_SIZE_SLUGS = new Set(APPAREL_SIZE_OPTIONS.map((o) => o.value))

export function isApparelSizeSlug(value: string): boolean {
  return APPAREL_SIZE_SLUGS.has(value)
}

const APPAREL_SIZE_LABELS = labelMap(APPAREL_SIZE_OPTIONS)

function labelMap(options: readonly ApparelFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function apparelSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return APPAREL_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function apparelSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isApparelSizeSlug(v) ? v : null
}
