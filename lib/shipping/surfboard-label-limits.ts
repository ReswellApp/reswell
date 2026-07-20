/** Official UPS Ground max for Length + (2 × Width) + (2 × Height). */
export const UPS_MAX_LENGTH_PLUS_GIRTH_IN = 165

/** Buffer below the UPS hard limit to account for measurement error. */
export const RESWELL_UPS_DIMENSION_BUFFER_IN = 5

/** Max UPS dimensional total Reswell can ship (165″ − 5″ buffer). */
export const SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN =
  UPS_MAX_LENGTH_PLUS_GIRTH_IN - RESWELL_UPS_DIMENSION_BUFFER_IN

/** Max packed parcel weight Reswell can print a carrier label for. */
export const SURFBOARD_LABEL_MAX_WEIGHT_LB = 25

/** Per-axis upper bounds for manual parcel entry (separate from the UPS total). */
export const SURFBOARD_LABEL_MAX_LENGTH_IN = 210
export const SURFBOARD_LABEL_MAX_WIDTH_IN = 56
export const SURFBOARD_LABEL_MAX_HEIGHT_IN = 42

export const SURFBOARD_LABEL_LIMITS_ERROR =
  "We cannot ship packages that exceed UPS size limits. Packed size must be 160″ or less using Length + (2 × Width) + (2 × Height), and weight must be 25 lb or less."

export type SurfboardLabelParcelDims = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

/** UPS Ground: Length + (2 × Width) + (2 × Height). */
export function upsLengthPlusGirthIn(lengthIn: number, widthIn: number, heightIn: number): number {
  return lengthIn + 2 * widthIn + 2 * heightIn
}

export function validateSurfboardLabelParcelLimits(
  parcel: SurfboardLabelParcelDims,
): { ok: true } | { ok: false; error: string } {
  const { lengthIn, widthIn, heightIn, weightLb } = parcel

  if (
    !Number.isFinite(lengthIn) ||
    !Number.isFinite(widthIn) ||
    !Number.isFinite(heightIn) ||
    !Number.isFinite(weightLb)
  ) {
    return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
  }

  const upsTotal = upsLengthPlusGirthIn(lengthIn, widthIn, heightIn)
  if (upsTotal > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN || weightLb > SURFBOARD_LABEL_MAX_WEIGHT_LB) {
    return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
  }

  return { ok: true }
}

export function isSurfboardLabelParcelLimitError(error: string): boolean {
  return error.trim() === SURFBOARD_LABEL_LIMITS_ERROR
}
