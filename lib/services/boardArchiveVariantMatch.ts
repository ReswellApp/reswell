/**
 * Size match for `public.board_archive`.
 *
 * The write path is `board_archive_match_variant` in
 * `supabase/migrations/20270930120000_board_archive.sql`. Keep these rules aligned:
 * a variant is stored only when length and volume (whichever the listing has)
 * identify exactly one surfboard size, optionally narrowed by fin system and setup.
 */

export const BOARD_ARCHIVE_LENGTH_TOLERANCE_INCHES = 0.6
export const BOARD_ARCHIVE_VOLUME_TOLERANCE_LITERS = 0.15

export type BoardArchiveVariantCandidate = {
  id: string
  lengthInches: number | null
  volumeLiters: number | null
  finBoxType: string | null
  finBoxes: string | null
}

export type BoardArchiveListingDims = {
  lengthTotalInches: number | null
  volumeLiters: number | null
  finSystem: string | null
  finsSetup: string | null
}

/** Feet + inches from a catalog length label (`5'10`, `5'10 1/2`, `6'`). */
export function parseBoardArchiveLengthInches(label: string | null | undefined): number | null {
  const raw = label?.trim() ?? ""
  if (!raw) return null
  const match = raw.match(/(\d+)\s*['′’]\s*(\d+(?:\.\d+)?)?(?:\s+(\d+)\s*\/\s*(\d+))?/u)
  if (!match) return null
  const feet = Number(match[1])
  let inches = match[2] ? Number(match[2]) : 0
  if (match[3] && match[4]) {
    const denominator = Number(match[4])
    if (!Number.isFinite(denominator) || denominator === 0) return null
    inches += Number(match[3]) / denominator
  }
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
  if (feet < 1 || feet > 15 || inches < 0 || inches >= 12) return null
  return feet * 12 + inches
}

/** First number in a catalog volume label (`28.5L`, `28 L`). */
export function parseBoardArchiveVolumeLiters(label: string | null | undefined): number | null {
  const raw = label?.trim().toLowerCase() ?? ""
  if (!raw) return null
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/u)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function narrowByExact<T>(rows: T[], read: (row: T) => string | null, wanted: string | null): T[] {
  const target = wanted?.trim() ?? ""
  if (!target) return rows
  const matched = rows.filter((row) => read(row) === target)
  return matched.length > 0 ? matched : rows
}

/**
 * Returns a variant id only when the listing's measurements pick one catalog size.
 * Missing length or volume is ignored. Missing both, or more than one survivor, returns null.
 */
export function selectBoardArchiveVariant(
  candidates: readonly BoardArchiveVariantCandidate[],
  listing: BoardArchiveListingDims,
): string | null {
  const length = listing.lengthTotalInches
  const volume = listing.volumeLiters
  if (length == null && volume == null) return null

  const bySize = candidates.filter((candidate) => {
    if (length != null) {
      if (candidate.lengthInches == null) return false
      if (Math.abs(candidate.lengthInches - length) > BOARD_ARCHIVE_LENGTH_TOLERANCE_INCHES) {
        return false
      }
    }
    if (volume != null) {
      if (candidate.volumeLiters == null) return false
      if (Math.abs(candidate.volumeLiters - volume) > BOARD_ARCHIVE_VOLUME_TOLERANCE_LITERS) {
        return false
      }
    }
    return true
  })

  const byFin = narrowByExact(bySize, (row) => row.finBoxType, listing.finSystem)
  const bySetup = narrowByExact(byFin, (row) => row.finBoxes, listing.finsSetup)
  return bySetup.length === 1 ? bySetup[0].id : null
}
