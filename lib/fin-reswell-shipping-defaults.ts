/**
 * Default packed parcel for fin listings using Reswell-calculated shipping when the
 * seller leaves dimensions and/or weight blank on `/sell/fins`.
 */
export const FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN = "10"
export const FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN = "7"
export const FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN = "4"
export const FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_LB = "3"
export const FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ = ""

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

/** Fills missing fin Reswell parcel fields with the standard fin box defaults. */
export function applyFinReswellPackageDefaults<T extends FinReswellPackageFormFields>(
  fields: T,
): T {
  const dimsBlank = finReswellPackageDimensionsAllBlank(fields)
  const weightBlank = finReswellPackageWeightAllBlank(fields)
  if (!dimsBlank && !weightBlank) return fields

  return {
    ...fields,
    reswellPackageLengthIn: dimsBlank
      ? FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN
      : fields.reswellPackageLengthIn,
    reswellPackageWidthIn: dimsBlank
      ? FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN
      : fields.reswellPackageWidthIn,
    reswellPackageHeightIn: dimsBlank
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
