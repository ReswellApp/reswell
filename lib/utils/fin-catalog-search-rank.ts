import {
  FIN_SETUP_OPTIONS,
  FIN_SIZE_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
} from "@/lib/fin-listing-config"
import type {
  FinCatalogSearchBrandRow,
  FinCatalogSearchModelRow,
  FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"

export type FinCatalogSearchResultRow =
  | FinCatalogSearchBrandRow
  | FinCatalogSearchModelRow
  | FinCatalogSearchVariantRow

export type FinCatalogSearchRankMode = "strict" | "relaxed"

const FACET_NOISE = new Set<string>()
for (const opt of FIN_SYSTEM_OPTIONS_FOR_FINS) {
  FACET_NOISE.add(opt.value.toLowerCase())
  FACET_NOISE.add(opt.label.toLowerCase())
  for (const part of opt.label.toLowerCase().split(/[\s/]+/)) {
    if (part.length >= 2) FACET_NOISE.add(part)
  }
}
for (const opt of FIN_SETUP_OPTIONS) {
  FACET_NOISE.add(opt.value.toLowerCase())
  FACET_NOISE.add(opt.label.toLowerCase())
}
for (const opt of FIN_SIZE_OPTIONS) {
  FACET_NOISE.add(opt.value.toLowerCase())
}
FACET_NOISE.add("fin")
FACET_NOISE.add("fins")
FACET_NOISE.add("compatible")
FACET_NOISE.add("system")

/** Common fin-catalog aliases (e.g. "ci" → channel islands). */
const FIN_CATALOG_TOKEN_SYNONYMS: Record<string, readonly string[]> = {
  ci: ["channel", "islands"],
  pv: ["pacific", "vibrations"],
  ta: ["true", "ames"],
  fcs2: ["fcs"],
  fcsii: ["fcs"],
  tri: ["tri", "thruster"],
  blackstix: ["blackstix", "black"],
  honeycomb: ["honeycomb"],
  hexcore: ["hexcore"],
  am1: ["am1"],
  am2: ["am2"],
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function tokenize(raw: string): string[] {
  const tokens = raw.toLowerCase().match(/[\w']+/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const t = token.replace(/^['']+|['']+$/g, "")
    if (t.length < 2 || /^\d+$/.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** Tokens used for brand/model matching — facet vocabulary is optional, not sufficient alone. */
export function finCatalogMeaningfulSearchTokens(qRaw: string): string[] {
  const tokens = tokenize(qRaw)
  const meaningful = tokens.filter((t) => !FACET_NOISE.has(t))
  return meaningful.length > 0 ? meaningful : tokens
}

/** Expand query tokens with fin-catalog synonyms for broader DB recall. */
export function expandFinCatalogSearchTokens(qRaw: string): string[] {
  const base = finCatalogMeaningfulSearchTokens(qRaw)
  const out = new Set<string>(base)
  for (const token of base) {
    const synonyms = FIN_CATALOG_TOKEN_SYNONYMS[token]
    if (synonyms) {
      for (const syn of synonyms) out.add(syn)
    }
  }
  return [...out]
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[] = new Array(rows * cols)
  for (let i = 0; i < rows; i++) matrix[i * cols] = i
  for (let j = 0; j < cols; j++) matrix[j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const idx = i * cols + j
      matrix[idx] = Math.min(
        matrix[(i - 1) * cols + j] + 1,
        matrix[i * cols + (j - 1)] + 1,
        matrix[(i - 1) * cols + (j - 1)] + cost,
      )
    }
  }
  return matrix[(rows - 1) * cols + (cols - 1)]
}

function wordsFromHaystack(haystack: string): string[] {
  return haystack.split(/[\s\-_/()+.]+/).filter((w) => w.length >= 2)
}

function tokenMatchesField(token: string, field: string, fuzzy: boolean): boolean {
  const f = field.toLowerCase()
  if (!f) return false
  if (f.includes(token)) return true
  if (!fuzzy || token.length < 4) return false

  for (const word of wordsFromHaystack(f)) {
    if (word.startsWith(token)) return true
    if (token.startsWith(word) && word.length >= 3) return true
    if (word.length >= 3 && levenshtein(word, token) <= 1) return true
  }
  return false
}

function countTokenMatches(
  tokens: readonly string[],
  title: string,
  brand: string,
  model: string,
  fuzzy: boolean,
): number {
  let matched = 0
  for (const token of tokens) {
    if (
      tokenMatchesField(token, title, fuzzy) ||
      tokenMatchesField(token, brand, fuzzy) ||
      tokenMatchesField(token, model, fuzzy)
    ) {
      matched++
    }
  }
  return matched
}

function rowBrandName(row: FinCatalogSearchResultRow): string {
  if (row.kind === "brand") return row.name
  return row.brandName
}

function rowModelName(row: FinCatalogSearchResultRow): string | null {
  if (row.kind === "brand") return null
  if (row.kind === "model") return row.name
  return row.modelName
}

function rowCatalogTitle(row: FinCatalogSearchResultRow): string {
  const brand = rowBrandName(row).trim()
  const model = rowModelName(row)?.trim()
  return model ? `${brand} ${model}` : brand
}

function rowDedupeKey(row: FinCatalogSearchResultRow): string {
  if (row.kind === "brand") return `brand:${row.id}`
  const model = rowModelName(row)?.trim().toLowerCase() ?? ""
  return `model:${row.brandId}:${model}`
}

function kindRankBonus(kind: FinCatalogSearchResultRow["kind"]): number {
  if (kind === "variant") return 4
  if (kind === "model") return 2
  return 0
}

function facetBoost(row: FinCatalogSearchResultRow, q: string, title: string): number {
  let score = 0
  if (q.includes("futures") && title.includes("futures")) score += 45
  if (q.includes("fcs") && title.includes("fcs")) score += 45
  if (row.kind === "variant") {
    if (q.includes("futures") && row.finSystem === "futures") score += 25
    if (q.includes("fcs") && row.finSystem.startsWith("fcs")) score += 25
  }
  return score
}

/** Higher = better match for brand + model title relevance. */
export function scoreFinCatalogSearchRow(
  row: FinCatalogSearchResultRow,
  qRaw: string,
  mode: FinCatalogSearchRankMode = "strict",
): number {
  const q = normalizeText(qRaw)
  if (!q) return 0

  const title = normalizeText(rowCatalogTitle(row))
  const brand = normalizeText(rowBrandName(row))
  const model = normalizeText(rowModelName(row) ?? "")
  const tokens = finCatalogMeaningfulSearchTokens(q)
  const fuzzy = mode === "relaxed"
  const matchedCount = countTokenMatches(tokens, title, brand, model, fuzzy)
  const tokenTotal = tokens.length

  if (tokenTotal > 0) {
    if (mode === "strict") {
      if (matchedCount < tokenTotal) return 0
    } else {
      const minRequired =
        tokenTotal <= 2 ? 1 : Math.max(1, Math.ceil(tokenTotal * 0.5))
      if (matchedCount < minRequired) return 0
    }
  }

  let score = kindRankBonus(row.kind)

  if (title === q) score += 1000
  else if (title.startsWith(q)) score += 700
  else if (model.startsWith(q) || brand.startsWith(q)) score += 500
  else if (title.includes(q)) score += 350

  for (const token of tokens) {
    if (model === token) score += 120
    else if (model.startsWith(token)) score += 80
    else if (brand === token) score += 70
    else if (brand.startsWith(token)) score += 50
    else if (tokenMatchesField(token, model, fuzzy)) score += 30
    else if (tokenMatchesField(token, brand, fuzzy)) score += 20
  }

  if (mode === "relaxed" && tokenTotal > 0) {
    score += Math.round((matchedCount / tokenTotal) * 120)
  }

  score += facetBoost(row, q, title)
  return score
}

/** Rank and dedupe catalog rows — one best row per brand or brand+model pair. */
export function rankFinCatalogSearchResults(
  qRaw: string,
  rows: FinCatalogSearchResultRow[],
  limit = 12,
  mode: FinCatalogSearchRankMode = "strict",
): FinCatalogSearchResultRow[] {
  const q = qRaw.trim()
  if (!q) return []

  const byKey = new Map<string, { row: FinCatalogSearchResultRow; score: number }>()
  for (const row of rows) {
    const score = scoreFinCatalogSearchRow(row, q, mode)
    if (score <= 0) continue
    const key = rowDedupeKey(row)
    const existing = byKey.get(key)
    if (!existing || score > existing.score) {
      byKey.set(key, { row, score })
    }
  }

  return [...byKey.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return rowCatalogTitle(a.row).localeCompare(rowCatalogTitle(b.row))
    })
    .slice(0, limit)
    .map((entry) => entry.row)
}
