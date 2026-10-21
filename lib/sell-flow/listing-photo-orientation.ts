import type { PrepareListingImagePairOptions } from "@/lib/listing-image-pipeline"

/** Extra clockwise 90° turns on top of automatic camera orientation. */
export type ListingPhotoQuarterTurns = 0 | 1 | 2 | 3

/** A saved turn. Zero means "leave the current photo as it is." */
export type ListingPhotoQuarterTurnDelta = 1 | 2 | 3

export type ListingPhotoOrientationSource = {
  /** Extra clockwise turns applied to this slot's base file. */
  userQuarterTurns?: number
  /**
   * Older in-session flag: one extra 180° after automatic orientation.
   * Ignored once `userQuarterTurns` is set.
   */
  userRotate180?: boolean
  /**
   * Base file is an already-straightened listing photo.
   * Skip the landscape→portrait pass so a 90° correction is not undone.
   */
  sourceIsDerivative?: boolean
}

export function normalizeListingPhotoQuarterTurns(
  value: number | undefined,
): ListingPhotoQuarterTurns {
  if (value == null || !Number.isFinite(value)) return 0
  const turns = ((Math.trunc(value) % 4) + 4) % 4
  return turns as ListingPhotoQuarterTurns
}

export function addListingPhotoQuarterTurns(
  current: number | undefined,
  delta: number,
): ListingPhotoQuarterTurns {
  return normalizeListingPhotoQuarterTurns((current ?? 0) + delta)
}

export function effectiveListingPhotoQuarterTurns(
  slot: ListingPhotoOrientationSource,
): ListingPhotoQuarterTurns {
  if (slot.userQuarterTurns != null) {
    return normalizeListingPhotoQuarterTurns(slot.userQuarterTurns)
  }
  return slot.userRotate180 ? 2 : 0
}

/**
 * Pipeline options for one photo.
 *
 * Original camera bytes keep EXIF auto-orient and the portrait pass, then the
 * seller's extra turns. A downloaded listing file is already straightened, so
 * only the extra turns run.
 */
export function listingPhotoOrientationPrepareOptions(
  slot: ListingPhotoOrientationSource,
): PrepareListingImagePairOptions {
  return {
    skipLandscapeToPortrait: Boolean(slot.sourceIsDerivative),
    rotateClockwiseQuarterTurns: effectiveListingPhotoQuarterTurns(slot),
  }
}

/**
 * Quarter turns to bake on the next encode.
 * A retained base file accumulates. A fresh download already looks like the
 * tile, so only the new turn is applied.
 */
export function listingPhotoQuarterTurnsAfterAdjust(
  slot: ListingPhotoOrientationSource & { sourceFile?: File },
  delta: number,
): { userQuarterTurns: ListingPhotoQuarterTurns; sourceIsDerivative: boolean } {
  if (slot.sourceFile) {
    return {
      userQuarterTurns: addListingPhotoQuarterTurns(
        effectiveListingPhotoQuarterTurns(slot),
        delta,
      ),
      sourceIsDerivative: Boolean(slot.sourceIsDerivative),
    }
  }
  return {
    userQuarterTurns: normalizeListingPhotoQuarterTurns(delta),
    sourceIsDerivative: true,
  }
}
