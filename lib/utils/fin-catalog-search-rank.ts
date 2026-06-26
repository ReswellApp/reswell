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
// Size slugs only — words like "large" also appear in model names (e.g. "Tri Large").
for (const opt of FIN_SIZE_OPTIONS) {
  FACET_NOISE.add(opt.value.toLowerCase())
}
FACET_NOISE.add("fin")
FACET_NOISE.add("fins")
FACET_NOISE.add("compatible")
FACET_NOISE.add("system")

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

/** Higher = better match for brand + model title relevance. */
export function scoreFinCatalogSearchRow(
  row: FinCatalogSearchResultRow,
  qRaw: string,
): number {
  const q = normalizeText(qRaw)
  if (!q) return 0

  const title = normalizeText(rowCatalogTitle(row))
  const brand = normalizeText(rowBrandName(row))
  const model = normalizeText(rowModelName(row) ?? "")
  const haystack = `${brand} ${model}`.trim()
  const tokens = finCatalogMeaningfulSearchTokens(q)

  if (tokens.length > 0) {
    const allMatch = tokens.every(
      (token) => title.includes(token) || brand.includes(token) || model.includes(token),
    )
    if (!allMatch) return 0
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
    else if (model.includes(token)) score += 30
    else if (brand.includes(token)) score += 20
  }

  if (q.includes("futures") && title.includes("futures")) score += 45
  if (q.includes("fcs") && title.includes("fcs")) score += 45
  if (row.kind === "variant") {
    if (q.includes("futures") && row.finSystem === "futures") score += 25
    if (q.includes("fcs") && row.finSystem.startsWith("fcs")) score += 25
  }

  return score
}

/** Rank and dedupe catalog rows — one best row per brand or brand+model pair. */
export function rankFinCatalogSearchResults(
  qRaw: string,
  rows: FinCatalogSearchResultRow[],
  limit = 12,
): FinCatalogSearchResultRow[] {
  const q = qRaw.trim()
  if (!q) return []

  const byKey = new Map<string, { row: FinCatalogSearchResultRow; score: number }>()
  for (const row of rows) {
    const score = scoreFinCatalogSearchRow(row, q)
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
