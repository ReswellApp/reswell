/**
 * Resolves fin browse facets from structured listing columns, falling back to
 * conservative keyword hints in title / brand / model / description when sellers
 * left optional sell-form fields blank.
 */

import { FIN_SETUP_OPTIONS, FIN_SYSTEM_OPTIONS_FOR_FINS } from "@/lib/fin-listing-config"
import { parseFinsSetupFromStorage, type FinSetupTagSlug } from "@/lib/listing-fin-setup-tags"

export type FinListingFacetSource = {
  fins_setup?: string | null
  fin_system?: string | null
  title?: string | null
  brand?: string | null
  model?: string | null
  description?: string | null
}

const FIN_SETUP_SLUGS = FIN_SETUP_OPTIONS.map((o) => o.value)
const FIN_SYSTEM_SLUGS = FIN_SYSTEM_OPTIONS_FOR_FINS.map((o) => o.value)

/** Lowercase searchable blob from listing text fields. */
export function finListingSearchBlob(row: FinListingFacetSource): string {
  return [row.title, row.brand, row.model, row.description]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase()
}

const FIN_SETUP_TEXT_HINTS: Record<FinSetupTagSlug, readonly string[]> = {
  single: ["single fin", "single-fin", " single "],
  twin_only: ["keel", "keels", " twin fin", " twin fins", " twin set", " twins "],
  twin: ["2+1", "two plus one", "twin (2+1)"],
  thruster: ["thruster", "tri-fin", "tri fin", "3 fin"],
  quad: ["quad"],
  five: ["5-fin", "5 fin", "five fin", "5 fin"],
  other: [],
}

const FIN_SYSTEM_TEXT_HINTS: Record<string, readonly string[]> = {
  futures: ["futures"],
  fcs_ii: ["fcs ii", "fcs 2", "fcsii"],
  fcs_twin_tab: ["fcs twin tab", "twin tab"],
  single: ["single fin box", "single-fin box"],
  two_plus_one_futures: ["2+1 futures"],
  two_plus_one_fcs: ["2+1 fcs"],
  glass_on: ["glass on", "glass-on", "glasson"],
  other: [],
}

function textHintsMatch(blob: string, hints: readonly string[]): boolean {
  return hints.some((hint) => blob.includes(hint))
}

function inferFinSetupSlugs(blob: string): FinSetupTagSlug[] {
  const out: FinSetupTagSlug[] = []
  for (const slug of FIN_SETUP_SLUGS) {
    const hints = FIN_SETUP_TEXT_HINTS[slug as FinSetupTagSlug]
    if (hints.length > 0 && textHintsMatch(blob, hints)) {
      out.push(slug as FinSetupTagSlug)
    }
  }
  return out
}

function inferFinSystemSlug(blob: string): string | null {
  for (const slug of FIN_SYSTEM_SLUGS) {
    const hints = FIN_SYSTEM_TEXT_HINTS[slug]
    if (hints && hints.length > 0 && textHintsMatch(blob, hints)) {
      return slug
    }
  }
  return null
}

/** Fin setup slugs for browse matching — structured column first, then text hints. */
export function effectiveFinSetupSlugs(row: FinListingFacetSource): FinSetupTagSlug[] {
  const stored = parseFinsSetupFromStorage(row.fins_setup)
  if (stored.length > 0) return stored
  return inferFinSetupSlugs(finListingSearchBlob(row))
}

/** Fin system slug for browse matching — structured column first, then text hints. */
export function effectiveFinSystemSlug(row: FinListingFacetSource): string | null {
  const stored = row.fin_system?.trim().toLowerCase() ?? ""
  if (stored && FIN_SYSTEM_SLUGS.includes(stored)) return stored
  return inferFinSystemSlug(finListingSearchBlob(row))
}

export function finSetupMatchesSelection(row: FinListingFacetSource, selected: string[]): boolean {
  if (selected.length === 0) return true
  const slugs = effectiveFinSetupSlugs(row)
  return selected.some((v) => slugs.includes(v as FinSetupTagSlug))
}

export function finSystemMatchesSelection(row: FinListingFacetSource, selected: string[]): boolean {
  if (selected.length === 0) return true
  const slug = effectiveFinSystemSlug(row)
  return slug != null && selected.includes(slug)
}

/** PostgREST ilike patterns for a fin-setup slug (structured + text hints). */
export function finSetupFilterPatterns(slug: string): string[] {
  if (!/^[a-z0-9_]+$/.test(slug)) return []
  const hints = FIN_SETUP_TEXT_HINTS[slug as FinSetupTagSlug] ?? []
  const patterns = [
    `fins_setup.eq.${slug}`,
    `fins_setup.ilike."${slug},%"`,
    `fins_setup.ilike."%,${slug}"`,
    `fins_setup.ilike."%,${slug},%"`,
  ]
  for (const hint of hints) {
    const safe = hint.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    patterns.push(`title.ilike."%${safe}%"`)
    patterns.push(`description.ilike."%${safe}%"`)
    patterns.push(`brand.ilike."%${safe}%"`)
    patterns.push(`model.ilike."%${safe}%"`)
  }
  return patterns
}

/** PostgREST ilike patterns for a fin-system slug (structured + text hints). */
export function finSystemFilterPatterns(slug: string): string[] {
  if (!/^[a-z0-9_]+$/.test(slug)) return []
  const hints = FIN_SYSTEM_TEXT_HINTS[slug] ?? []
  const patterns = [`fin_system.eq.${slug}`]
  for (const hint of hints) {
    const safe = hint.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    patterns.push(`title.ilike."%${safe}%"`)
    patterns.push(`description.ilike."%${safe}%"`)
    patterns.push(`brand.ilike."%${safe}%"`)
    patterns.push(`model.ilike."%${safe}%"`)
  }
  return patterns
}
