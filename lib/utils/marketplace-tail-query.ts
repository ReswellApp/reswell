/**
 * Deterministic tail-shape extraction from free-text search.
 * Complements Gemini NL so "lost round tail" / "squash pin" become filters.
 */

import {
  TAIL_SHAPE_LABELS,
  TAIL_SHAPE_TAG_OPTIONS,
  type TailShapeTagSlug,
} from "@/lib/listing-tail-shape-tags"

/** Longer phrases first so "round pin" / "round tail" beat bare "round". */
const TAIL_SHAPE_ALIASES: Array<{ slug: TailShapeTagSlug; phrases: string[] }> = [
  { slug: "round", phrases: ["round pin", "round tail", "roundtail", "round"] },
  { slug: "squash", phrases: ["squash tail", "squash"] },
  { slug: "square", phrases: ["square tail", "square"] },
  { slug: "pin", phrases: ["pin tail", "pintail", "pin"] },
  { slug: "swallow", phrases: ["swallow tail", "swallowtail", "swallow"] },
  { slug: "fish", phrases: ["fish tail", "fishtail"] },
]

const ALLOWED = new Set(TAIL_SHAPE_TAG_OPTIONS.map((o) => o.value))

export function extractTailShapesFromQuery(rawQuery: string): string[] {
  const lower = rawQuery.trim().toLowerCase()
  if (!lower) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of TAIL_SHAPE_ALIASES) {
    if (!ALLOWED.has(row.slug) || seen.has(row.slug)) continue
    for (const phrase of row.phrases) {
      const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?:[^a-z0-9]|$)`, "i")
      if (re.test(lower)) {
        seen.add(row.slug)
        out.push(row.slug)
        break
      }
    }
  }
  return out
}

export function queryMentionsTailFilters(rawQuery: string): boolean {
  return extractTailShapesFromQuery(rawQuery).length > 0
}

export function tailShapeLabel(slug: string): string {
  return TAIL_SHAPE_LABELS[slug as TailShapeTagSlug] ?? slug.replace(/_/g, " ")
}

/** Strip tail-shape phrases from residual keyword once they've become filters. */
export function stripTailFilterPhrasesFromKeyword(raw: string): string {
  let s = raw.trim()
  if (!s) return ""
  const phrases = TAIL_SHAPE_ALIASES.flatMap((r) => r.phrases).sort((a, b) => b.length - a.length)
  for (const phrase of phrases) {
    const re = new RegExp(`(?:^|\\s+)${escapeRegExp(phrase)}(?=\\s+|$)`, "gi")
    s = s.replace(re, " ")
  }
  // Lone "tail" after shape words were removed.
  s = s.replace(/(?:^|\s+)tails?(?=\s+|$)/gi, " ")
  return s.replace(/\s+/g, " ").trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
