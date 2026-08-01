/**
 * Deterministic fin system / setup extraction from free-text search.
 * Used alongside Gemini NL parse so "boards with fcs" / "thruster futures"
 * always become `/boards` facet filters.
 */

import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"

/** Alias phrases → `listings.fin_system` slug. Longer phrases matched first. */
const FIN_SYSTEM_ALIASES: Array<{ slug: string; phrases: string[] }> = [
  { slug: "fcs_ii", phrases: ["fcs ii", "fcs 2", "fcs2", "fcsii", "fcs"] },
  { slug: "fcs_twin_tab", phrases: ["fcs twin tab", "twin tab", "fcs twin"] },
  {
    slug: "two_plus_one_futures",
    phrases: ["2+1 futures", "2 + 1 futures", "two plus one futures"],
  },
  {
    slug: "two_plus_one_fcs",
    phrases: ["2+1 fcs", "2 + 1 fcs", "two plus one fcs"],
  },
  { slug: "futures", phrases: ["futures", "future fins", "future"] },
  { slug: "glass_on", phrases: ["glass on", "glassed on"] },
  { slug: "single", phrases: ["single fin box", "single box"] },
]

/** Alias phrases → `listings.fins_setup` slug (layout). */
const FIN_SETUP_ALIASES: Array<{ slug: string; phrases: string[] }> = [
  { slug: "five", phrases: ["5 fin", "5-fin", "five fin", "5fins"] },
  { slug: "thruster", phrases: ["thruster", "tri fin", "tri-fin", "trifin"] },
  { slug: "twin_only", phrases: ["twin only", "twin fin", "twin"] },
  { slug: "twin", phrases: ["2+1", "2 + 1", "two plus one"] },
  { slug: "quad", phrases: ["quad fin", "quad"] },
  { slug: "single", phrases: ["single fin", "single"] },
]

const ALLOWED_FIN_SYSTEMS = new Set(FIN_SYSTEM_OPTIONS.map((o) => o.value))
const ALLOWED_FIN_SETUPS = new Set(FIN_SETUP_OPTIONS.map((o) => o.value))

function matchAliasSlugs(
  lower: string,
  aliases: Array<{ slug: string; phrases: string[] }>,
  allowed: Set<string>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of aliases) {
    if (!allowed.has(row.slug)) continue
    const hit = row.phrases.some((p) => {
      if (p.includes(" ")) return lower.includes(p)
      return new RegExp(`(?:^|[^a-z0-9])${p}(?:[^a-z0-9]|$)`, "i").test(lower)
    })
    if (!hit || seen.has(row.slug)) continue
    seen.add(row.slug)
    out.push(row.slug)
  }
  return out
}

export function extractFinSystemsFromQuery(rawQuery: string): string[] {
  return matchAliasSlugs(rawQuery.trim().toLowerCase(), FIN_SYSTEM_ALIASES, ALLOWED_FIN_SYSTEMS)
}

export function extractFinSetupsFromQuery(rawQuery: string): string[] {
  const lower = rawQuery.trim().toLowerCase()
  // Avoid treating "twin tab" (fin system) as a twin layout.
  if (/\btwin\s*tab\b/.test(lower) || /\bfcs\s*twin\b/.test(lower)) {
    return matchAliasSlugs(lower, FIN_SETUP_ALIASES, ALLOWED_FIN_SETUPS).filter(
      (s) => s !== "twin_only" && s !== "twin",
    )
  }
  return matchAliasSlugs(lower, FIN_SETUP_ALIASES, ALLOWED_FIN_SETUPS)
}

/** True when the query mentions fin system or setup language. */
export function queryMentionsFinFilters(rawQuery: string): boolean {
  return (
    extractFinSystemsFromQuery(rawQuery).length > 0 ||
    extractFinSetupsFromQuery(rawQuery).length > 0
  )
}

export function finSystemLabel(slug: string): string {
  return FIN_SYSTEM_OPTIONS.find((o) => o.value === slug)?.label ?? slug.replace(/_/g, " ")
}

export function finSetupLabel(slug: string): string {
  return FIN_SETUP_OPTIONS.find((o) => o.value === slug)?.label ?? slug.replace(/_/g, " ")
}

/** Remove fin alias tokens from leftover keyword text once they've become filters. */
export function stripFinFilterPhrasesFromKeyword(raw: string): string {
  let s = ` ${raw.trim().toLowerCase()} `
  const phrases = [
    ...FIN_SYSTEM_ALIASES.flatMap((r) => r.phrases),
    ...FIN_SETUP_ALIASES.flatMap((r) => r.phrases),
    "with fins",
    "fin system",
    "fin setup",
    "fins",
  ].sort((a, b) => b.length - a.length)

  for (const phrase of phrases) {
    const re = new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "gi")
    s = s.replace(re, " ")
  }
  return s.replace(/\s+/g, " ").trim()
}
