/**
 * Single source of truth for the fin marketplace product type.
 *
 * Fins are stored as `listings` rows with `section = 'fins'`. Fin-specific
 * attributes reuse existing listings columns — `fins_setup` (setup),
 * `fin_system` (system), `brand`/`brand_id`/`model`/`brand_model_id` — plus the
 * fins-only `fin_size` column. This module owns the shared vocabulary (option
 * slugs + labels) consumed by the /sell fins flow, the /fins browse filters, the
 * fins PDP, and SEO/sitemap helpers.
 *
 * Fin setup + fin system reuse the exact slugs already used on surfboard
 * listings (`lib/listing-fin-setup-tags.ts`, `lib/boards-browse-facets.ts`) so
 * a buyer's mental model is consistent across the catalog.
 */

import { FIN_SETUP_TAG_OPTIONS } from "@/lib/listing-fin-setup-tags"
import { FIN_SYSTEM_OPTIONS } from "@/lib/boards-browse-facets"

export const FINS_SECTION = "fins" as const

/**
 * Fixed `categories.id` for peer-to-peer fins. Must match the seed in
 * migration `20261201120000_fins_marketplace.sql`. `listings.category_id` is
 * NOT NULL, so every fin listing references this row.
 */
export const USED_FINS_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000001"

export type FinFacetOption = { value: string; label: string }

/** Fin layout (Single, Twin, Thruster, …) — reuses surfboard fin-setup slugs. */
export const FIN_SETUP_OPTIONS: readonly FinFacetOption[] = FIN_SETUP_TAG_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

/** Fin plug/box system (Futures, FCS II, Glass On, …) — reuses surfboard fin-system slugs. */
export const FIN_SYSTEM_OPTIONS_FOR_FINS: readonly FinFacetOption[] = FIN_SYSTEM_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

/** Fin size — stored as a slug in `listings.fin_size`. */
export const FIN_SIZE_OPTIONS: readonly FinFacetOption[] = [
  { value: "xs", label: "XS (Grom)" },
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
  { value: "xl", label: "X-Large" },
  { value: "other", label: "Other" },
]

const FIN_SETUP_SLUGS = new Set(FIN_SETUP_OPTIONS.map((o) => o.value))
const FIN_SYSTEM_SLUGS = new Set(FIN_SYSTEM_OPTIONS_FOR_FINS.map((o) => o.value))
const FIN_SIZE_SLUGS = new Set(FIN_SIZE_OPTIONS.map((o) => o.value))

export function isFinSetupSlug(value: string): boolean {
  return FIN_SETUP_SLUGS.has(value)
}

export function isFinSystemSlug(value: string): boolean {
  return FIN_SYSTEM_SLUGS.has(value)
}

export function isFinSizeSlug(value: string): boolean {
  return FIN_SIZE_SLUGS.has(value)
}

const FIN_SETUP_LABELS = labelMap(FIN_SETUP_OPTIONS)
const FIN_SYSTEM_LABELS = labelMap(FIN_SYSTEM_OPTIONS_FOR_FINS)
const FIN_SIZE_LABELS = labelMap(FIN_SIZE_OPTIONS)

function labelMap(options: readonly FinFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function finSetupLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return FIN_SETUP_LABELS[slug] ?? null
}

export function finSystemLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return FIN_SYSTEM_LABELS[slug] ?? null
}

export function finSizeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return FIN_SIZE_LABELS[slug] ?? null
}

/** Normalize a raw form value to an allowed slug or null (for DB writes). */
export function finSetupSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isFinSetupSlug(v) ? v : null
}

export function finSystemSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isFinSystemSlug(v) ? v : null
}

export function finSizeSlugForDb(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? ""
  return isFinSizeSlug(v) ? v : null
}
