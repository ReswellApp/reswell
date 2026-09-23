import {
  canonicalBoardLengthFilterToken,
  normalizeBoardLengthInput,
  parseBoardMeasurement,
} from "../board-measurements.ts"
import {
  sellPhotoObservationSchema,
  type SellPhotoMatchCategory,
  type SellPhotoObservation,
} from "../validations/sellPhotoMatch.ts"

/** One encoded shot. Three shots must stay under the platform request body limit. */
export const SELL_PHOTO_MATCH_MAX_BYTES = 1_100_000
export const SELL_PHOTO_MATCH_MAX_TOTAL_BYTES = 3_600_000

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
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (EMPTY_NAME.has(trimmed.toLowerCase())) return null
  return trimmed.slice(0, max)
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
    brandText: cleanName(row.brandText, 80),
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
