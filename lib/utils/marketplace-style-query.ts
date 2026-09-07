/**
 * Deterministic board-style extraction from free-text search.
 * "fish" / "shortboard" / "groveler" are shapes, not brand names.
 */

import { BOARD_STYLE_OPTIONS } from "@/lib/boards-browse-facets"
import { stripMarketplaceSearchNoiseWords } from "@/lib/utils/marketplace-brand-query"
import { isGenericFinLayoutSearchToken } from "@/lib/utils/marketplace-fin-query"

/** Longer phrases first so "short board" / "step-up gun" beat shorter tokens. */
const BOARD_STYLE_ALIASES: Array<{ slug: string; phrases: string[] }> = [
  {
    slug: "step-up-gun",
    phrases: [
      "step-up gun",
      "step up gun",
      "step-up",
      "step up",
      "stepup",
      "step-ups",
      "guns",
      "gun",
    ],
  },
  {
    slug: "shortboard",
    phrases: ["shortboards", "short board", "shortboard"],
  },
  {
    slug: "longboard",
    phrases: ["longboards", "long board", "longboard"],
  },
  {
    slug: "hybrid",
    phrases: [
      "mid-length",
      "mid length",
      "midlength",
      "funboards",
      "fun board",
      "funboard",
      "hybrids",
      "hybrid",
    ],
  },
  { slug: "groveler", phrases: ["grovelers", "groveler"] },
  { slug: "fish", phrases: ["fish boards", "fish board", "fishes", "fish"] },
  { slug: "asym", phrases: ["asymmetrical", "asymmetric", "asyms", "asym"] },
]

const ALLOWED_STYLES = new Set(BOARD_STYLE_OPTIONS.map((o) => o.value))

/**
 * Single-word style aliases that must never hard-resolve a directory brand
 * ("fish" → Fish Stix, "gun" → a brand whose name contains gun).
 */
const GENERIC_SURF_SEARCH_TOKENS = new Set(
  BOARD_STYLE_ALIASES.flatMap((row) =>
    row.phrases.filter((p) => !p.includes(" ") && !p.includes("-")),
  ),
)

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function phraseBoundaryRe(phrase: string): RegExp {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?:[^a-z0-9]|$)`, "i")
}

function queryLooksLikeFishTail(lower: string): boolean {
  return /\bfish\s*tails?\b/.test(lower) || /\bfishtails?\b/.test(lower)
}

/** True when this token is a generic shape or fin-layout word, not a brand hint. */
export function isGenericSurfSearchToken(token: string): boolean {
  const core = token.trim().toLowerCase().replace(/^['']+|['']+$/g, "")
  return (
    core.length > 0 &&
    (GENERIC_SURF_SEARCH_TOKENS.has(core) || isGenericFinLayoutSearchToken(core))
  )
}

/**
 * True when every meaningful token is a board-style or fin-layout word
 * (e.g. "fish", "fish board", "fish twin"). "fish stix" / "ci fish" are not generic-only.
 */
export function isMarketplaceGenericSurfSearchOnly(rawQuery: string): boolean {
  const stripped = stripMarketplaceSearchNoiseWords(rawQuery)
  const source = stripped || (rawQuery || "").trim()
  const tokens =
    source
      .toLowerCase()
      .match(/[\w']+/g)
      ?.map((t) => t.replace(/^['']+|['']+$/g, ""))
      .filter((t) => t.length >= 2) ?? []
  if (tokens.length === 0) return false
  return tokens.every((t) => isGenericSurfSearchToken(t))
}

export function extractBoardStylesFromQuery(rawQuery: string): string[] {
  const lower = rawQuery.trim().toLowerCase()
  if (!lower) return []
  const skipFishStyle = queryLooksLikeFishTail(lower)
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of BOARD_STYLE_ALIASES) {
    if (!ALLOWED_STYLES.has(row.slug) || seen.has(row.slug)) continue
    if (skipFishStyle && row.slug === "fish") continue
    const hit = row.phrases.some((p) => phraseBoundaryRe(p).test(lower))
    if (!hit) continue
    seen.add(row.slug)
    out.push(row.slug)
  }
  return out
}

export function queryMentionsBoardStyles(rawQuery: string): boolean {
  return extractBoardStylesFromQuery(rawQuery).length > 0
}

export function boardStyleLabel(slug: string): string {
  return BOARD_STYLE_OPTIONS.find((o) => o.value === slug)?.label ?? slug.replace(/-/g, " ")
}

/** Strip style phrases from leftover keyword once they've become filters. */
export function stripBoardStylePhrasesFromKeyword(raw: string): string {
  let s = raw.trim()
  if (!s) return ""
  const phrases = BOARD_STYLE_ALIASES.flatMap((r) => r.phrases).sort((a, b) => b.length - a.length)
  for (const phrase of phrases) {
    const re = new RegExp(`(?:^|\\s+)${escapeRegExp(phrase)}(?=\\s+|$)`, "gi")
    s = s.replace(re, " ")
  }
  return s.replace(/\s+/g, " ").trim()
}

/**
 * True when the query is only a board style (plus marketplace noise like "board"),
 * e.g. "fish", "used fish boards" — not "fish stix" or "ci fish".
 */
export function isMarketplaceBoardStyleOnlyQuery(rawQuery: string): boolean {
  const trimmed = (rawQuery || "").trim()
  if (!trimmed) return false
  const styles = extractBoardStylesFromQuery(trimmed)
  if (styles.length === 0) return false
  const leftover = stripMarketplaceSearchNoiseWords(stripBoardStylePhrasesFromKeyword(trimmed))
  return leftover.length === 0
}

/** Browse hub for a style-only query (`fish` → `/boards?type=fish&q=fish`). */
export function marketplaceBoardStyleBrowseHref(rawQuery: string): string | null {
  if (!isMarketplaceBoardStyleOnlyQuery(rawQuery)) return null
  const styles = extractBoardStylesFromQuery(rawQuery)
  if (styles.length !== 1) return null
  const slug = styles[0]
  if (!slug) return null
  const trimmed = rawQuery.trim()
  const params = new URLSearchParams()
  params.set("type", slug)
  if (trimmed) params.set("q", trimmed)
  return `/boards?${params.toString()}`
}
