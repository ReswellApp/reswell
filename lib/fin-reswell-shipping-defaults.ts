/**
 * Default packed parcel dimensions for fin listings using Reswell-calculated shipping when the
 * seller leaves dimensions blank on `/sell/fins`. Weight must be entered by the seller at publish;
 * rating-time fallbacks still use {@link applyFinReswellPackageDefaultsPerField}.
 */
export const FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN = "10"
export const FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN = "7"
export const FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN = "4"
export const FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_LB = "3"
export const FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ = ""

export const FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM = 10
export const FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM = 7
export const FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM = 4
export const FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM =
  Number(FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_LB) * 16

export type FinReswellPackageFormFields = {
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim()
}

export function finReswellPackageDimensionsAllBlank(
  fields: FinReswellPackageFormFields,
): boolean {
  return (
    isBlank(fields.reswellPackageLengthIn) &&
    isBlank(fields.reswellPackageWidthIn) &&
    isBlank(fields.reswellPackageHeightIn)
  )
}

/** True when the seller started entering dimensions but did not complete all three. */
export function finReswellPackageHasPartialDimensions(
  fields: FinReswellPackageFormFields,
): boolean {
  const filled = [
    !isBlank(fields.reswellPackageLengthIn),
    !isBlank(fields.reswellPackageWidthIn),
    !isBlank(fields.reswellPackageHeightIn),
  ]
  return filled.some(Boolean) && !filled.every(Boolean)
}

export function finReswellPackageWeightAllBlank(fields: FinReswellPackageFormFields): boolean {
  return isBlank(fields.reswellPackageWeightLb) && isBlank(fields.reswellPackageWeightOz)
}

/** Coerces stored listing packed fields into sell-form strings for default merging. */
export function finReswellPackageFormFieldsFromListingRow(row: {
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
}): FinReswellPackageFormFields {
  const formatDim = (value: number | string | null | undefined): string => {
    if (value == null || value === "") return ""
    const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? String(n) : ""
  }
  const ozTotal = row.shipping_packed_weight_oz
  if (ozTotal == null || ozTotal === "") {
    return {
      reswellPackageLengthIn: formatDim(row.shipping_packed_length_in),
      reswellPackageWidthIn: formatDim(row.shipping_packed_width_in),
      reswellPackageHeightIn: formatDim(row.shipping_packed_height_in),
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }
  }
  const totalOz =
    typeof ozTotal === "number" ? ozTotal : Number.parseFloat(String(ozTotal).replace(/,/g, ""))
  if (!Number.isFinite(totalOz) || totalOz <= 0) {
    return {
      reswellPackageLengthIn: formatDim(row.shipping_packed_length_in),
      reswellPackageWidthIn: formatDim(row.shipping_packed_width_in),
      reswellPackageHeightIn: formatDim(row.shipping_packed_height_in),
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }
  }
  const lb = Math.floor(totalOz / 16)
  const ozRem = Math.round((totalOz - lb * 16) * 100) / 100
  const ozStr =
    Number.isInteger(ozRem) ? String(ozRem) : ozRem.toFixed(2).replace(/\.?0+$/, "")
  return {
    reswellPackageLengthIn: formatDim(row.shipping_packed_length_in),
    reswellPackageWidthIn: formatDim(row.shipping_packed_width_in),
    reswellPackageHeightIn: formatDim(row.shipping_packed_height_in),
    reswellPackageWeightLb: String(lb),
    reswellPackageWeightOz: ozStr,
  }
}

/**
 * Fills each missing fin dimension/weight field individually (used at rating time when
 * stored values are partial or unusable).
 */
export function applyFinReswellPackageDefaultsPerField<T extends FinReswellPackageFormFields>(
  fields: T,
): T {
  const weightBlank = finReswellPackageWeightAllBlank(fields)
  return {
    ...fields,
    reswellPackageLengthIn: isBlank(fields.reswellPackageLengthIn)
      ? FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN
      : fields.reswellPackageLengthIn,
    reswellPackageWidthIn: isBlank(fields.reswellPackageWidthIn)
      ? FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN
      : fields.reswellPackageWidthIn,
    reswellPackageHeightIn: isBlank(fields.reswellPackageHeightIn)
      ? FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN
      : fields.reswellPackageHeightIn,
    reswellPackageWeightLb: weightBlank
      ? FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_LB
      : fields.reswellPackageWeightLb,
    reswellPackageWeightOz: weightBlank
      ? FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ
      : fields.reswellPackageWeightOz,
  }
}

/** Fills missing fin Reswell parcel dimension fields with the standard fin box defaults. */
export function applyFinReswellPackageDefaults<T extends FinReswellPackageFormFields>(
  fields: T,
): T {
  if (!finReswellPackageDimensionsAllBlank(fields)) return fields

  return {
    ...fields,
    reswellPackageLengthIn: FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN,
    reswellPackageWidthIn: FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN,
    reswellPackageHeightIn: FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN,
  }
}
