/**
 * Normalize free-text marketplace search (e.g. `/search?q=`) for directory brand resolution.
 * Strips generic listing words so "andreini surfboards" resolves to brand "Andreini".
 */

import type { ElasticsearchIndexedListingSection } from "@/lib/elasticsearch/listing-sections"
import { marketplaceBrandSynonymCandidates } from "@/lib/utils/marketplace-brand-synonyms"

const MARKETPLACE_SEARCH_NOISE_WORDS = new Set([
  "surfboard",
  "surfboards",
  "board",
  "boards",
  "surf",
  "fin",
  "fins",
  "wetsuit",
  "wetsuits",
  "magazine",
  "magazines",
  "used",
  "new",
  "for",
  "sale",
  "listing",
  "listings",
  "shop",
  "buy",
  "sell",
  "gear",
])

/**
 * Query tokens that imply a marketplace listing section (e.g. "channel islands fins").
 * Bare "board(s)" stay noise-only — they do not force surfboards scope.
 */
const SECTION_INTENT_BY_TOKEN: Record<string, ElasticsearchIndexedListingSection> = {
  fin: "fins",
  fins: "fins",
  wetsuit: "wetsuits",
  wetsuits: "wetsuits",
  magazine: "magazines",
  magazines: "magazines",
  surfboard: "surfboards",
  surfboards: "surfboards",
}

const SECTION_INTENT_PRIORITY: ElasticsearchIndexedListingSection[] = [
  "fins",
  "wetsuits",
  "magazines",
  "surfboards",
]

/**
 * Detect listing-section intent from free-text (does not remove tokens — use noise strip for that).
 */
export function extractMarketplaceSectionIntent(
  rawQuery: string,
): ElasticsearchIndexedListingSection | null {
  const tokens = tokenizeQuery(rawQuery)
  if (tokens.length === 0) return null
  const found = new Set<ElasticsearchIndexedListingSection>()
  for (const token of tokens) {
    const section = SECTION_INTENT_BY_TOKEN[token]
    if (section) found.add(section)
  }
  if (found.size === 0) return null
  for (const section of SECTION_INTENT_PRIORITY) {
    if (found.has(section)) return section
  }
  return null
}

/**
 * True when the query is only a marketplace section keyword (plus noise),
 * e.g. "fins", "used wetsuits" — not "channel islands fins" or "futures fins".
 */
export function isMarketplaceSectionOnlyQuery(rawQuery: string): boolean {
  const trimmed = (rawQuery || "").trim()
  if (!trimmed) return false
  if (!extractMarketplaceSectionIntent(trimmed)) return false
  return stripMarketplaceSearchNoiseWords(trimmed).length === 0
}

/** Browse hub for a listing section (`fins` → `/fins`). */
export function marketplaceSectionBrowseHref(
  section: ElasticsearchIndexedListingSection | null,
): string | null {
  switch (section) {
    case "fins":
      return "/fins"
    case "wetsuits":
      return "/wetsuits"
    case "magazines":
      return "/magazines"
    case "surfboards":
      return "/boards"
    default:
      return null
  }
}

function tokenizeQuery(raw: string): string[] {
  const s = raw.trim().toLowerCase()
  if (!s) return []
  const tokens = s.match(/[\w']+/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of tokens) {
    const core = t.replace(/^['']+|['']+$/g, "")
    if (core.length < 2) continue
    if (seen.has(core)) continue
    seen.add(core)
    out.push(core)
  }
  return out
}

/** Remove generic marketplace words from a search phrase. */
export function stripMarketplaceSearchNoiseWords(raw: string): string {
  const tokens = tokenizeQuery(raw)
  const kept = tokens.filter((t) => !MARKETPLACE_SEARCH_NOISE_WORDS.has(t))
  return kept.join(" ").trim()
}

/**
 * Ordered labels to try when mapping user text → `public.brands` (longest / most specific first).
 */
export function marketplaceBrandQueryCandidates(raw: string): string[] {
  const trimmed = (raw || "").trim()
  if (!trimmed) return []

  const seen = new Set<string>()
  const out: string[] = []
  const add = (s: string) => {
    const t = s.trim()
    if (t.length < 2) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }

  add(trimmed)
  const stripped = stripMarketplaceSearchNoiseWords(trimmed)
  add(stripped)

  const tokens = tokenizeQuery(stripped.length > 0 ? stripped : trimmed)
  const byLength = [...tokens].sort((a, b) => b.length - a.length)
  for (const token of byLength) {
    add(token)
  }

  for (const alias of marketplaceBrandSynonymCandidates(trimmed)) {
    add(alias)
  }

  return out
}

/** True when a token is only generic marketplace vocabulary (not a brand hint). */
export function isMarketplaceSearchNoiseToken(token: string): boolean {
  const core = token.trim().toLowerCase().replace(/^['']+|['']+$/g, "")
  return core.length > 0 && MARKETPLACE_SEARCH_NOISE_WORDS.has(core)
}

export function levenshteinDistance(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const rows = left.length + 1
  const cols = right.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0) as number[])

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[left.length][right.length]
}

/** Max edit distance allowed for a typo-tolerant brand name match. */
export function maxBrandTypoDistance(queryLen: number, brandLen: number): number {
  const n = Math.min(queryLen, brandLen)
  if (n <= 3) return 0
  if (n <= 6) return 1
  if (n <= 10) return 2
  return 3
}

export type BrandNameRow = { name: string; slug?: string }

/** Minimum edit distance between label and any brand signal (name, slug, first token). */
export function brandCatalogTypoDistance(
  label: string,
  row: { name: string; slug?: string },
): number {
  const q = label.trim().toLowerCase()
  if (!q) return Number.POSITIVE_INFINITY

  const name = row.name.trim().toLowerCase()
  let best = name ? levenshteinDistance(q, name) : Number.POSITIVE_INFINITY

  const slug = row.slug?.trim().toLowerCase()
  if (slug) {
    best = Math.min(best, levenshteinDistance(q, slug))
    best = Math.min(best, levenshteinDistance(q, slug.replace(/-/g, "")))
  }

  const firstToken = name.match(/[\w']+/g)?.[0]
  if (firstToken && firstToken.length >= 3) {
    best = Math.min(best, levenshteinDistance(q, firstToken))
  }

  return best
}

/**
 * Pick the catalog brand closest to the user label (typos), comparing name, slug, and first name token.
 */
export function pickClosestBrandNameMatch<T extends BrandNameRow>(
  rows: T[],
  label: string,
): T | null {
  const q = label.trim().toLowerCase()
  if (!q || rows.length === 0) return null

  let best: T | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const row of rows) {
    const distance = brandCatalogTypoDistance(q, row)
    if (!Number.isFinite(distance)) continue
    const compareLen = Math.max(
      q.length,
      row.name.trim().length,
      row.slug?.replace(/-/g, "").length ?? 0,
    )
    const allowed = maxBrandTypoDistance(q.length, compareLen)
    if (distance > allowed) continue
    if (distance < bestDistance) {
      bestDistance = distance
      best = row
    }
  }

  return best
}

/** Tokens worth a fuzzy catalog scan (noise stripped, length ≥ 4). */
export function fuzzyBrandLookupTokens(rawLabel: string): string[] {
  const candidates = marketplaceBrandQueryCandidates(rawLabel)
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of candidates) {
    const t = c.trim().toLowerCase()
    if (t.length < 4 || isMarketplaceSearchNoiseToken(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.sort((a, b) => b.length - a.length)
}

/** Prefix length for typo-tolerant brand directory scan (e.g. andreni → andr). */
export function fuzzyBrandNamePrefix(token: string): string {
  const t = token.trim().toLowerCase()
  if (t.length <= 4) return t.slice(0, 3)
  return t.slice(0, 4)
}

/** True when the matched brand name is not literally present in the user's query (likely a typo correction). */
export function isLikelyTypoBrandMatch(rawQuery: string, brandName: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  const brand = brandName.trim().toLowerCase()
  if (!q || !brand) return false
  if (q.includes(brand)) return false
  const brandTokens = brand.match(/[\w']+/g) ?? []
  return !brandTokens.some((t) => t.length >= 3 && q.includes(t))
}

/**
 * Meaningful query text left after removing a directory brand name (and marketplace noise).
 * e.g. "channel islands dumpster diver" + "Channel Islands" → "dumpster diver"
 */
export function residualMarketplaceQueryAfterBrand(rawQuery: string, brandName: string): string {
  let residual = (rawQuery || "").trim().toLowerCase()
  const brand = (brandName || "").trim().toLowerCase()
  if (!residual || !brand) return stripMarketplaceSearchNoiseWords(residual)

  if (residual.includes(brand)) {
    residual = residual.split(brand).join(" ")
  } else {
    const brandTokens = brand.match(/[\w']+/g) ?? []
    for (const token of brandTokens) {
      if (token.length < 2) continue
      residual = residual
        .split(/\s+/)
        .filter((t) => {
          const core = t.replace(/^['']+|['']+$/g, "")
          return core !== token
        })
        .join(" ")
    }
  }

  return stripMarketplaceSearchNoiseWords(residual)
}

/** True when the query is effectively just this brand (plus optional noise like "surfboards" / "fins"). */
export function isBrandOnlyMarketplaceSuggestQuery(rawQuery: string, brandName: string): boolean {
  return (
    stripMarketplaceSearchNoiseWords(residualMarketplaceQueryAfterBrand(rawQuery, brandName))
      .length === 0
  )
}
