/** Official UPS Ground max for Length + (2 × Width) + (2 × Height). */
export const UPS_MAX_LENGTH_PLUS_GIRTH_IN = 165

/** Human-readable surfboard DIM formula — used in seller UI and validation copy. */
export const SURFBOARD_SHIPPING_DIM_FORMULA = "Box Length + 2×Width + 2×Height"

/** Buffer below the UPS hard limit to account for measurement error. */
export const RESWELL_UPS_DIMENSION_BUFFER_IN = 5

/** Max surfboard DIM Reswell can ship (165″ − 5″ buffer). */
export const SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN =
  UPS_MAX_LENGTH_PLUS_GIRTH_IN - RESWELL_UPS_DIMENSION_BUFFER_IN

/** Max packed parcel weight Reswell can print a carrier label for. */
export const SURFBOARD_LABEL_MAX_WEIGHT_LB = 25

/** Per-axis upper bounds for manual parcel entry (separate from the UPS total). */
export const SURFBOARD_LABEL_MAX_LENGTH_IN = 210
export const SURFBOARD_LABEL_MAX_WIDTH_IN = 56
export const SURFBOARD_LABEL_MAX_HEIGHT_IN = 42

export const SURFBOARD_LABEL_LIMITS_ERROR =
  `We cannot ship packages that exceed UPS size limits. Packed size must be ${SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″ or less using ${SURFBOARD_SHIPPING_DIM_FORMULA}, and weight must be 25 lb or less.`

export type SurfboardLabelParcelDims = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

/**
 * Carrier dimensional size (DIM) for surfboard parcels.
 * Standard for all Reswell surfboard shipping: Box Length + 2×Width + 2×Height.
 */
export function surfboardShippingDimIn(
  lengthIn: number,
  widthIn: number,
  heightIn: number,
): number {
  return lengthIn + 2 * widthIn + 2 * heightIn
}

/** @deprecated Prefer {@link surfboardShippingDimIn}. */
export function upsLengthPlusGirthIn(lengthIn: number, widthIn: number, heightIn: number): number {
  return surfboardShippingDimIn(lengthIn, widthIn, heightIn)
}

/** Largest packed length (in) allowed for a W×H box at or below the Reswell DIM cap. */
export function maxSurfboardPackedLengthInAtDimLimit(
  widthIn: number,
  heightIn: number,
  maxDimIn: number = SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
): number {
  return maxDimIn - 2 * widthIn - 2 * heightIn
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

  const dimTotal = surfboardShippingDimIn(lengthIn, widthIn, heightIn)
  if (dimTotal > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN || weightLb > SURFBOARD_LABEL_MAX_WEIGHT_LB) {
    return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
  }

  return { ok: true }
}

export function isSurfboardLabelParcelLimitError(error: string): boolean {
  return error.trim() === SURFBOARD_LABEL_LIMITS_ERROR
}
