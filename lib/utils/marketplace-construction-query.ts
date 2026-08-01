/**
 * Deterministic construction extraction from free-text search.
 * So "epoxy boards" / "eps" become `/boards` construction=eps_epoxy filters.
 */

import { CONSTRUCTION_OPTIONS } from "@/lib/boards-browse-facets"

/** Alias phrases → `listings.construction` slug. Longer phrases matched first. */
const CONSTRUCTION_ALIASES: Array<{ slug: string; phrases: string[] }> = [
  {
    slug: "eps_epoxy",
    phrases: [
      "eps/epoxy",
      "eps / epoxy",
      "eps-epoxy",
      "eps epoxy",
      "epoxy",
      "eps",
    ],
  },
  {
    slug: "pu_poly",
    phrases: [
      "pu/poly",
      "pu / poly",
      "pu-poly",
      "pu poly",
      "polyurethane",
      "poly",
      "pu",
    ],
  },
  {
    slug: "carbon",
    phrases: ["carbon fiber", "carbon fibre", "carbon"],
  },
]

const ALLOWED = new Set(CONSTRUCTION_OPTIONS.map((o) => o.value))

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function extractConstructionsFromQuery(rawQuery: string): string[] {
  const lower = rawQuery.trim().toLowerCase()
  if (!lower) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of CONSTRUCTION_ALIASES) {
    if (!ALLOWED.has(row.slug) || seen.has(row.slug)) continue
    const hit = row.phrases.some((p) => {
      if (p.includes(" ") || p.includes("/") || p.includes("-")) {
        return lower.includes(p)
      }
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(p)}(?:[^a-z0-9]|$)`, "i").test(lower)
    })
    if (!hit) continue
    seen.add(row.slug)
    out.push(row.slug)
  }
  return out
}

export function queryMentionsConstructionFilters(rawQuery: string): boolean {
  return extractConstructionsFromQuery(rawQuery).length > 0
}

export function constructionLabel(slug: string): string {
  return CONSTRUCTION_OPTIONS.find((o) => o.value === slug)?.label ?? slug.replace(/_/g, " ")
}

/** Remove construction alias tokens from leftover keyword once they've become filters. */
export function stripConstructionFilterPhrasesFromKeyword(raw: string): string {
  let s = ` ${raw.trim().toLowerCase()} `
  const phrases = CONSTRUCTION_ALIASES.flatMap((r) => r.phrases).sort(
    (a, b) => b.length - a.length,
  )
  for (const phrase of phrases) {
    const re = new RegExp(
      `(?:^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`,
      "gi",
    )
    s = s.replace(re, " ")
  }
  return s.replace(/\s+/g, " ").trim()
}
