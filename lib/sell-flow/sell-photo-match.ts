import {
  canonicalBoardLengthFilterToken,
  normalizeBoardLengthInput,
  parseBoardMeasurement,
} from "../board-measurements.ts"
import type {
  SellCatalogSearchMatchTier,
  SellCatalogSearchResultRow,
} from "../types/sell-catalog-search.ts"
import {
  sellPhotoObservationSchema,
  type SellPhotoMatchCategory,
  type SellPhotoObservation,
} from "../validations/sellPhotoMatch.ts"

/** One encoded shot. Three shots must stay under the platform request body limit. */
export const SELL_PHOTO_MATCH_MAX_BYTES = 1_100_000
export const SELL_PHOTO_MATCH_MAX_TOTAL_BYTES = 3_600_000

/** How many photos from one live listing the matcher will read. */
export const SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT = 6

export const SELL_PHOTO_MATCH_SHOTS = ["top", "bottom", "dimensions"] as const
export type SellPhotoMatchShot = (typeof SELL_PHOTO_MATCH_SHOTS)[number]

export const SELL_PHOTO_MATCH_SHOT_LABEL: Record<SellPhotoMatchShot, string> = {
  top: "Top",
  bottom: "Bottom",
  dimensions: "Dimensions",
}

export type SellPhotoMatchMime = "image/jpeg" | "image/png" | "image/webp"

const EMPTY_NAME = new Set(["null", "unknown", "n/a", "none", "unreadable"])

const VISIBLE_TEXT_STOP = new Set([
  "surfboard",
  "surfboards",
  "board",
  "fin",
  "fins",
  "used",
  "new",
  "logo",
])

function cleanName(value: unknown, max: number): string | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value
  if (typeof text !== "string") return null
  const trimmed = text
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!trimmed) return null
  if (EMPTY_NAME.has(trimmed.toLowerCase())) return null
  return trimmed.slice(0, max)
}

/**
 * Logos are often initials. Map those to the catalog brand before search.
 * Keys are compacted (`ci`, `lostsurfboards`).
 */
const SELL_PHOTO_BRAND_ALIASES: Record<string, string> = {
  ci: "Channel Islands",
  channelisland: "Channel Islands",
  channelislands: "Channel Islands",
  js: "JS Industries",
  jsindustries: "JS Industries",
  pv: "Pacific Vibrations",
  pacificvibrations: "Pacific Vibrations",
  ta: "True Ames",
  trueames: "True Ames",
  lost: "Lost",
  mayhem: "Lost",
  lostsurfboards: "Lost",
  haydenshapes: "Haydenshapes",
  haydenshape: "Haydenshapes",
  hs: "Haydenshapes",
  dhd: "DHD",
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function compactKeysMatch(query: string, field: string): boolean {
  const q = compactKey(query)
  const f = compactKey(field)
  if (!q || !f || q.length < 2) return false
  if (f === q || f.startsWith(q) || q.startsWith(f)) return true
  if (q.length >= 4 && f.length >= 4 && (f.includes(q) || q.includes(f))) return true
  return false
}

/** Canonical catalog brand when the photo text is a known logo alias. */
export function canonicalSellPhotoBrand(value: string | null): string | null {
  if (!value) return null
  const compact = compactKey(value)
  if (!compact) return null
  const stripped = compact.replace(/surfboards?$/, "")
  return SELL_PHOTO_BRAND_ALIASES[compact] ?? SELL_PHOTO_BRAND_ALIASES[stripped] ?? value
}

/**
 * Models sometimes return empty strings, "null", or "surfboard" instead of the
 * enum. Coerce into the schema before parse.
 */
export function coerceSellPhotoObservation(raw: unknown): SellPhotoObservation | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const categoryRaw = typeof row.category === "string" ? row.category.trim().toLowerCase() : ""
  const category =
    categoryRaw === "surfboard" || categoryRaw === "surfboards" || categoryRaw === "board"
      ? "surfboards"
      : categoryRaw === "fin" || categoryRaw === "fins"
        ? "fins"
        : "unknown"
  const confidenceRaw =
    typeof row.confidence === "string" ? row.confidence.trim().toLowerCase() : ""
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "low"
  const visibleText = Array.isArray(row.visibleText)
    ? row.visibleText
        .map((item) => cleanName(item, 80))
        .filter((item): item is string => Boolean(item))
        .filter((item) => !VISIBLE_TEXT_STOP.has(item.toLowerCase()))
        .slice(0, 8)
    : []
  const summary = cleanName(row.summary, 280) ?? "Photos scanned."

  const parsed = sellPhotoObservationSchema.safeParse({
    category,
    brandText: canonicalSellPhotoBrand(cleanName(row.brandText, 80)),
    modelText: cleanName(row.modelText, 80),
    visibleText,
    lengthText: cleanName(row.lengthText, 40),
    widthText: cleanName(row.widthText, 40),
    thicknessText: cleanName(row.thicknessText, 40),
    confidence,
    summary,
  })
  return parsed.success ? parsed.data : null
}

/** This experiment matches surfboards. The three shots are a board, not a fin. */
export function sellPhotoMatchSearchCategories(): SellPhotoMatchCategory[] {
  return ["surfboards"]
}

export function missingSellPhotoMatchShots(present: readonly string[]): SellPhotoMatchShot[] {
  const have = new Set(present)
  return SELL_PHOTO_MATCH_SHOTS.filter((shot) => !have.has(shot))
}

export type SellPhotoMatchDimensionFields = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
}

function measurementText(raw: string | null): string {
  if (!raw) return ""
  return raw
    .trim()
    .replace(/[″”"]/g, "")
    .replace(/\s*(inches|inch|in)\.?$/i, "")
    .trim()
    .slice(0, 24)
}

/** Dimensions safe to drop into the board sell form. Unreadable text is left blank. */
export function sellPhotoMatchDimensionFields(
  observation: SellPhotoObservation,
): SellPhotoMatchDimensionFields | null {
  const lengthNormalized = normalizeBoardLengthInput(observation.lengthText ?? "").replace(/"+$/g, "")
  const boardLength = canonicalBoardLengthFilterToken(lengthNormalized) ?? ""
  const widthRaw = measurementText(observation.widthText)
  const boardWidthInches = parseBoardMeasurement(widthRaw) != null ? widthRaw : ""
  const thicknessRaw = measurementText(observation.thicknessText)
  const boardThicknessInches = parseBoardMeasurement(thicknessRaw) != null ? thicknessRaw : ""
  if (!boardLength && !boardWidthInches && !boardThicknessInches) return null
  return { boardLength, boardWidthInches, boardThicknessInches }
}

export function fillEmptyBoardDimensions<T extends SellPhotoMatchDimensionFields>(
  current: T,
  dims: SellPhotoMatchDimensionFields | null,
): T {
  if (!dims) return current
  return {
    ...current,
    boardLength: current.boardLength.trim() ? current.boardLength : dims.boardLength || current.boardLength,
    boardWidthInches: current.boardWidthInches.trim()
      ? current.boardWidthInches
      : dims.boardWidthInches || current.boardWidthInches,
    boardThicknessInches: current.boardThicknessInches.trim()
      ? current.boardThicknessInches
      : dims.boardThicknessInches || current.boardThicknessInches,
  }
}

/** Used when the vision model cannot read the photos and the embedding still finds catalog rows. */
export function sellPhotoEmbeddingOnlyObservation(): SellPhotoObservation {
  return {
    category: "surfboards",
    brandText: null,
    modelText: null,
    visibleText: [],
    lengthText: null,
    widthText: null,
    thicknessText: null,
    confidence: "low",
    summary: "Matched these photos to similar boards in the catalog.",
  }
}

/** Catalog search string built only from text the model claims it could read. */
export function sellPhotoMatchLookupQuery(observation: SellPhotoObservation): string | null {
  const brand = observation.brandText?.trim() ?? ""
  const model = observation.modelText?.trim() ?? ""
  const combined = [brand, model].filter(Boolean).join(" ").trim()
  if (combined.length >= 2) return combined.slice(0, 200)

  const visible = observation.visibleText
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !VISIBLE_TEXT_STOP.has(item.toLowerCase()))
    .slice(0, 3)
    .join(" ")
    .trim()
  if (visible.length >= 2) return visible.slice(0, 200)
  return null
}

/** Ordered catalog queries: brand+model, then model, then brand, then other readable text. */
export function sellPhotoCatalogQueries(observation: SellPhotoObservation): string[] {
  const brand = observation.brandText?.trim() ?? ""
  const model = observation.modelText?.trim() ?? ""
  const queries: string[] = []
  const push = (value: string) => {
    const next = value.trim().replace(/\s+/g, " ").slice(0, 200)
    if (next.length < 2) return
    if (queries.some((query) => query.toLowerCase() === next.toLowerCase())) return
    queries.push(next)
  }
  if (brand && model) push(`${brand} ${model}`)
  if (model) push(model)
  if (brand) push(brand)
  for (const bit of observation.visibleText) {
    if (queries.length >= 4) break
    const text = bit.trim()
    if (text.length < 3) continue
    if (brand && text.toLowerCase() === brand.toLowerCase()) continue
    if (model && text.toLowerCase() === model.toLowerCase()) continue
    push(text)
  }
  return queries.slice(0, 4)
}

/**
 * Words read off the board, used as the embedding query.
 * A bare "surfboard" matches every catalog row, so it is never the query.
 */
export function sellPhotoEmbeddingQueryText(observation: SellPhotoObservation): string | null {
  const parts: string[] = []
  const push = (value: string | null) => {
    const next = value?.trim() ?? ""
    if (next.length < 2) return
    if (parts.some((part) => part.toLowerCase() === next.toLowerCase())) return
    parts.push(next)
  }
  push(observation.brandText)
  push(observation.modelText)
  for (const bit of observation.visibleText) {
    if (parts.length >= 4) break
    push(bit)
  }
  if (parts.length === 0) return null
  return parts.join(" ").slice(0, 500)
}

/**
 * Elasticsearch cosine kNN scores are about 0–1.
 * This scale only breaks ties. It stays below the brand-name bonus in the ranker.
 */
export const VISUAL_SCORE_SCALE = 36
/** Image-only neighbors below this are lookalikes, not an identity. */
const VISUAL_ONLY_FLOOR = 0.82
/** The top neighbor must lead the next one by this much or the photo is ambiguous. */
const VISUAL_ONLY_GAP = 0.03

/**
 * Keep photo nearest-neighbors that can identify a board.
 * A readable brand limits neighbors to that brand.
 * With no readable name, only a clear winner is kept.
 */
export function selectVisualCatalogHits(
  observation: SellPhotoObservation,
  hits: readonly { row: SellCatalogSearchResultRow; cosine: number }[],
): SellPhotoCatalogCandidate[] {
  const ranked = hits
    .filter((hit) => Number.isFinite(hit.cosine))
    .slice()
    .sort((a, b) => b.cosine - a.cosine || a.row.id.localeCompare(b.row.id))
  if (ranked.length === 0) return []

  const brand = observation.brandText
  const sameBrand = brand
    ? ranked.filter((hit) => namesMatch(brand, rowBrandName(hit.row)))
    : ranked

  let chosen = sameBrand
  if (brand) {
    chosen = sameBrand.filter((hit) => hit.cosine >= 0.55).slice(0, 6)
  } else {
    const best = sameBrand[0]
    const second = sameBrand[1]
    if (!best || best.cosine < VISUAL_ONLY_FLOOR) return []
    const gap = second ? best.cosine - second.cosine : VISUAL_ONLY_GAP
    if (gap < VISUAL_ONLY_GAP) return []
    chosen = sameBrand.filter((hit) => best.cosine - hit.cosine <= 0.01).slice(0, 2)
  }

  return chosen.map((hit) => ({
    row: hit.row,
    esScore: hit.cosine * VISUAL_SCORE_SCALE,
  }))
}

export type SellPhotoCatalogCandidate = {
  row: SellCatalogSearchResultRow
  /** Elasticsearch _score. Zero when the row came from the Postgres fallback. */
  esScore: number
}

const PHOTO_MATCH_ROW_LIMIT = 8

function nameTokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length >= 2)
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    let rowMin = curr[0] ?? i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const del = (prev[j] ?? 0) + 1
      const ins = (curr[j - 1] ?? 0) + 1
      const sub = (prev[j - 1] ?? 0) + cost
      const next = Math.min(del, ins, sub)
      curr[j] = next
      if (next < rowMin) rowMin = next
    }
    if (rowMin > 1) return rowMin
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? 0
  }
  return prev[b.length] ?? 3
}

function tokensMatch(query: string, field: string): boolean {
  const queryTokens = nameTokens(query)
  const fieldTokens = nameTokens(field)
  if (queryTokens.length === 0 || fieldTokens.length === 0) return false
  return queryTokens.every((queryToken) =>
    fieldTokens.some((fieldToken) => {
      if (fieldToken === queryToken || fieldToken.startsWith(queryToken)) return true
      return queryToken.length >= 4 && editDistance(queryToken, fieldToken) <= 1
    }),
  )
}

function namesMatch(query: string | null, field: string | null): boolean {
  if (!query || !field) return false
  if (compactKeysMatch(query, field)) return true
  if (tokensMatch(query, field)) return true
  const q = compactKey(query)
  const f = compactKey(field)
  return (
    q.length >= 5 &&
    f.length >= 5 &&
    Math.abs(q.length - f.length) <= 2 &&
    editDistance(q, f) <= 1
  )
}

function rowBrandName(row: SellCatalogSearchResultRow): string {
  return row.kind === "brand" ? row.name : row.brandName
}

function rowModelName(row: SellCatalogSearchResultRow): string | null {
  if (row.kind === "model") return row.name
  if (row.kind === "variant") return row.modelName
  return null
}

function looksLikeListingTitle(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (/\bused\b/.test(normalized)) return true
  if (/\bteam board\b/.test(normalized)) return true
  return false
}

/**
 * Prefer a catalog model whose brand and model both match the photo.
 * Elasticsearch score breaks ties. Brand-only rows stay in the similar tier.
 */
export function rankSellPhotoCatalogRows(
  observation: SellPhotoObservation,
  candidates: readonly SellPhotoCatalogCandidate[],
): { rows: SellCatalogSearchResultRow[]; matchTier: SellCatalogSearchMatchTier } {
  const brand = observation.brandText
  const model = observation.modelText
  const scored = candidates.map((candidate) => {
    const brandHit = namesMatch(brand, rowBrandName(candidate.row))
    const modelName = rowModelName(candidate.row)
    const modelHit = namesMatch(model, modelName)
    const listingPenalty =
      modelName && looksLikeListingTitle(modelName) ? 40 : 0
    const score =
      candidate.esScore +
      (candidate.row.kind === "model" ? 30 : 0) +
      (brandHit ? 100 : 0) +
      (modelHit ? 80 : 0) +
      (brandHit && modelHit ? 40 : 0) -
      listingPenalty
    return { ...candidate, score, exact: candidate.row.kind !== "brand" && brandHit && modelHit }
  })

  scored.sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id))

  const exact = scored.filter((candidate) => candidate.exact)
  const chosen = (exact.length > 0 ? exact : scored).slice(0, PHOTO_MATCH_ROW_LIMIT)
  if (chosen.length === 0) return { rows: [], matchTier: "none" }
  return {
    rows: chosen.map((candidate) => candidate.row),
    matchTier: exact.length > 0 ? "exact" : "similar",
  }
}

/** Pull a JSON object out of a model reply that ignored structured output. */
export function parseSellPhotoObservationJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced?.[1]?.trim() || trimmed
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

export function sniffSellPhotoMatchMime(bytes: Uint8Array): SellPhotoMatchMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}
