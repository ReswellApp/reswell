import {
  sellPhotoMatchDimensionFields,
  type SellPhotoMatchDimensionFields,
} from "@/lib/sell-flow/sell-photo-match"
import type { SellPhotoObservation } from "@/lib/validations/sellPhotoMatch"

const SELL_PHOTO_MATCH_DIMENSIONS_KEY = "reswell.sell.photoMatchDimensionsOnce"

function parseDimensions(raw: string | null): SellPhotoMatchDimensionFields | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const row = value as Record<string, unknown>
    if (
      typeof row.boardLength !== "string" ||
      typeof row.boardWidthInches !== "string" ||
      typeof row.boardThicknessInches !== "string"
    ) {
      return null
    }
    return {
      boardLength: row.boardLength,
      boardWidthInches: row.boardWidthInches,
      boardThicknessInches: row.boardThicknessInches,
    }
  } catch {
    return null
  }
}

/** One-shot dimensions from the admin photo match, read by the board sell form. */
export function writeSellPhotoMatchDimensions(observation: SellPhotoObservation): void {
  if (typeof window === "undefined") return
  const fields = sellPhotoMatchDimensionFields(observation)
  try {
    if (!fields) {
      sessionStorage.removeItem(SELL_PHOTO_MATCH_DIMENSIONS_KEY)
      return
    }
    sessionStorage.setItem(SELL_PHOTO_MATCH_DIMENSIONS_KEY, JSON.stringify(fields))
  } catch {
    /* quota / private mode */
  }
}

export function takeSellPhotoMatchDimensions(): SellPhotoMatchDimensionFields | null {
  if (typeof window === "undefined") return null
  try {
    const fields = parseDimensions(sessionStorage.getItem(SELL_PHOTO_MATCH_DIMENSIONS_KEY))
    sessionStorage.removeItem(SELL_PHOTO_MATCH_DIMENSIONS_KEY)
    return fields
  } catch {
    return null
  }
}
