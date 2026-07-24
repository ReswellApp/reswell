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

/**
 * Minimums for seller/admin label purchase. Intentionally category-agnostic so fins,
 * accessories, and boards can all enter the packed carton they will actually ship.
 */
export const LABEL_PARCEL_MIN_LENGTH_IN = 1
export const LABEL_PARCEL_MIN_WIDTH_IN = 1
export const LABEL_PARCEL_MIN_HEIGHT_IN = 1
/** ~1.6 oz — light enough for small fin boxes while staying > 0 for carriers. */
export const LABEL_PARCEL_MIN_WEIGHT_LB = 0.1

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

/**
 * Full manual parcel check for label rates/purchase: per-axis mins/maxes + UPS total.
 * Use this for any packed box the seller measures — not surfboard-only cartons.
 */
export function validateLabelParcelEntry(
  parcel: SurfboardLabelParcelDims,
): { ok: true } | { ok: false; error: string } {
  const { lengthIn, widthIn, heightIn, weightLb } = parcel

  if (!Number.isFinite(lengthIn) || lengthIn < LABEL_PARCEL_MIN_LENGTH_IN) {
    return {
      ok: false,
      error: `Length must be at least ${LABEL_PARCEL_MIN_LENGTH_IN} in (longest side of the packed box).`,
    }
  }
  if (lengthIn > SURFBOARD_LABEL_MAX_LENGTH_IN) {
    return { ok: false, error: `Length must be ${SURFBOARD_LABEL_MAX_LENGTH_IN} in or less.` }
  }
  if (!Number.isFinite(widthIn) || widthIn < LABEL_PARCEL_MIN_WIDTH_IN) {
    return {
      ok: false,
      error: `Width must be at least ${LABEL_PARCEL_MIN_WIDTH_IN} in.`,
    }
  }
  if (widthIn > SURFBOARD_LABEL_MAX_WIDTH_IN) {
    return { ok: false, error: `Width must be ${SURFBOARD_LABEL_MAX_WIDTH_IN} in or less.` }
  }
  if (!Number.isFinite(heightIn) || heightIn < LABEL_PARCEL_MIN_HEIGHT_IN) {
    return {
      ok: false,
      error: `Height must be at least ${LABEL_PARCEL_MIN_HEIGHT_IN} in.`,
    }
  }
  if (heightIn > SURFBOARD_LABEL_MAX_HEIGHT_IN) {
    return { ok: false, error: `Height must be ${SURFBOARD_LABEL_MAX_HEIGHT_IN} in or less.` }
  }
  if (!Number.isFinite(weightLb) || weightLb < LABEL_PARCEL_MIN_WEIGHT_LB) {
    return {
      ok: false,
      error: `Weight must be at least ${LABEL_PARCEL_MIN_WEIGHT_LB} lb.`,
    }
  }
  if (weightLb > SURFBOARD_LABEL_MAX_WEIGHT_LB) {
    return { ok: false, error: `Weight must be ${SURFBOARD_LABEL_MAX_WEIGHT_LB} lb or less.` }
  }

  return validateSurfboardLabelParcelLimits(parcel)
}

export function isSurfboardLabelParcelLimitError(error: string): boolean {
  return error.trim() === SURFBOARD_LABEL_LIMITS_ERROR
}
