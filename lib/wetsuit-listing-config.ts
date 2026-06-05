/**
 * Single source of truth for the wetsuit marketplace product type.
 *
 * Wetsuits are stored as `listings` rows with `section = 'wetsuits'`. The
 * wetsuit-specific size lives in the `wetsuit_size` column; brand/model reuse the
 * existing listings columns. This module owns the shared vocabulary (option slugs
 * + labels) consumed by the /sell wetsuits flow, the /wetsuits browse filters, the
 * wetsuits PDP, and SEO/sitemap helpers.
 *
 * Modeled on `lib/fin-listing-config.ts`.
 */

export const WETSUITS_SECTION = "wetsuits" as const

/**
 * Fixed `categories.id` for peer-to-peer wetsuits. Must match the seed in
 * migration `20261202120000_peer_accessory_types.sql`. `listings.category_id` is
 * NOT NULL, so every wetsuit listing references this row.
 */
export const USED_WETSUITS_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000002"

export type WetsuitFacetOption = { value: string; label: string }

/** Wetsuit size — stored as a slug in `listings.wetsuit_size`. */
export const WETSUIT_SIZE_OPTIONS: readonly WetsuitFacetOption[] = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S (Small)" },
  { value: "st", label: "ST (Small Tall)" },
  { value: "ms", label: "MS (Medium Short)" },
  { value: "m", label: "M (Medium)" },
  { value: "mt", label: "MT (Medium Tall)" },
  { value: "ls", label: "LS (Large Short)" },
  { value: "l", label: "L (Large)" },
  { value: "lt", label: "LT (Large Tall)" },
  { value: "xls", label: "XLS (XL Short)" },
  { value: "xl", label: "XL (X-Large)" },
  { value: "xlt", label: "XLT (XL Tall)" },
  { value: "xxl", label: "XXL" },
]

const WETSUIT_SIZE_SLUGS = new Set(WETSUIT_SIZE_OPTIONS.map((o) => o.value))

export function isWetsuitSizeSlug(value: string): boolean {
  return WETSUIT_SIZE_SLUGS.has(value)
}

const WETSUIT_SIZE_LABELS = labelMap(WETSUIT_SIZE_OPTIONS)

function labelMap(options: readonly WetsuitFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function wetsuitSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return WETSUIT_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function wetsuitSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isWetsuitSizeSlug(v) ? v : null
}
