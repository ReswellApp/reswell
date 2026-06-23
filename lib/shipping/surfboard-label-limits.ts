/** Max packed parcel length Reswell can print a carrier label for (6′5″). */
export const SURFBOARD_LABEL_MAX_LENGTH_IN = 77

/** Max packed parcel weight Reswell can print a carrier label for. */
export const SURFBOARD_LABEL_MAX_WEIGHT_LB = 25

export const SURFBOARD_LABEL_LIMITS_ERROR =
  "We cannot print a shipping label for packages longer than 6′5″ (77″ total) or heavier than 25 lb."

export type SurfboardLabelParcelDims = {
  lengthIn: number
  weightLb: number
}

export function validateSurfboardLabelParcelLimits(
  parcel: SurfboardLabelParcelDims,
): { ok: true } | { ok: false; error: string } {
  const lengthIn = parcel.lengthIn
  const weightLb = parcel.weightLb

  if (!Number.isFinite(lengthIn) || !Number.isFinite(weightLb)) {
    return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
  }

  if (lengthIn > SURFBOARD_LABEL_MAX_LENGTH_IN || weightLb > SURFBOARD_LABEL_MAX_WEIGHT_LB) {
    return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
  }

  return { ok: true }
}

export function isSurfboardLabelParcelLimitError(error: string): boolean {
  return error.trim() === SURFBOARD_LABEL_LIMITS_ERROR
}
