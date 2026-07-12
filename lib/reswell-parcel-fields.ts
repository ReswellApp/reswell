import {
  parseBoardMeasurement,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import { RESWELL_PLAIN_PARCEL_LENGTH_REINTERPRET_MIN_IN } from "@/lib/surfboard-shipping-estimates"

/**
 * Parcel length on `/sell`:
 * - Contains `'` (feet'inches, same as board length) → total inches for rating/DB.
 * - Plain number → outer packed length in inches (as entered).
 */
export function parseReswellParcelLengthRawToCarrierInches(raw: string | undefined): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const normalizedPrime = t.replace(/[\u2032\u2019＇]/g, "'")
  if (normalizedPrime.includes("'")) {
    const board = totalBoardLengthInchesFromCombinedInput(normalizedPrime)
    if (board == null || board <= 0) return null
    return board
  }
  // Spaced ft/in without a prime (e.g. `5 10`) — `parseFloat("5 10")` would incorrectly yield 5.
  const spaced = normalizedPrime.split(/\s+/).filter(Boolean)
  if (spaced.length >= 2) {
    const feetDigits = spaced[0].replace(/\D/g, "")
    const ft = feetDigits ? Number.parseInt(feetDigits, 10) : NaN
    const inchesCombined = spaced.slice(1).join(" ").trim()
    if (
      Number.isFinite(ft) &&
      ft >= 1 &&
      ft <= 15 &&
      inchesCombined &&
      !normalizedPrime.includes(",")
    ) {
      const board = totalBoardLengthInchesFromCombinedInput(`${ft}'${inchesCombined}`)
      if (board != null && board > 0) {
        return board
      }
    }
  }
  const n = parseFloat(normalizedPrime.replace(/,/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null

  const digitOnly = normalizedPrime.replace(/\s+/g, "").replace(/\D/g, "")
  if (
    n > RESWELL_PLAIN_PARCEL_LENGTH_REINTERPRET_MIN_IN &&
    digitOnly.length >= 3 &&
    /^\d+$/.test(digitOnly)
  ) {
    const reinterpretBare = totalBoardLengthInchesFromCombinedInput(digitOnly)
    if (reinterpretBare != null && reinterpretBare > 0) {
      return reinterpretBare
    }
    return null
  }

  return n
}

/**
 * Packed width / height: inch values (decimals or fractions); stored as entered for carriers.
 */
export function parseReswellParcelWidthHeightRawToCarrierInches(
  raw: string | undefined,
): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const v =
    parseBoardMeasurement(t) ??
    Number.parseFloat(t.replace(/\s+/g, "").replace(/,/g, ""))
  if (!Number.isFinite(v) || v <= 0) return null
  return v
}

/** Total ounces from sell-form lb/oz strings; `null` when blank or invalid. */
export function parseReswellPackedWeightToTotalOz(
  lbRaw: string | undefined,
  ozRaw: string | undefined,
): number | null {
  const lbTrim = lbRaw?.trim() ?? ""
  const ozTrim = ozRaw?.trim() ?? ""
  if (lbTrim === "" && ozTrim === "") return null
  const lb = lbTrim === "" ? 0 : Number.parseFloat(lbTrim.replace(/,/g, ""))
  const oz = ozTrim === "" ? 0 : Number.parseFloat(ozTrim.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) return null
  const totalOz = lb * 16 + oz
  if (!Number.isFinite(totalOz) || totalOz <= 0) return null
  return totalOz
}

/** User-facing error for required Reswell packed weight on `/sell` flows. */
export function validateReswellPackedWeightRequired(
  lbRaw: string | undefined,
  ozRaw: string | undefined,
): string | null {
  const lbTrim = lbRaw?.trim() ?? ""
  const ozTrim = ozRaw?.trim() ?? ""
  if (lbTrim === "" && ozTrim === "") {
    return "Enter packed weight in pounds and ounces."
  }
  const lb = lbTrim === "" ? 0 : Number.parseFloat(lbTrim.replace(/,/g, ""))
  const oz = ozTrim === "" ? 0 : Number.parseFloat(ozTrim.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0) {
    return "Enter a valid packed weight in pounds and ounces."
  }
  if (oz >= 16) {
    return "Ounces must be under 16 — add whole pounds in the pounds field instead."
  }
  const totalOz = lb * 16 + oz
  if (!Number.isFinite(totalOz) || totalOz <= 0) {
    return "Enter a positive packed weight."
  }
  return null
}

export function isReswellPackedWeightComplete(
  lbRaw: string | undefined,
  ozRaw: string | undefined,
): boolean {
  return validateReswellPackedWeightRequired(lbRaw, ozRaw) === null
}
