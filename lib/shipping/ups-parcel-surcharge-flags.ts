/**
 * UPS parcel surcharge triggers (2026 domestic rules) used for admin rate-cliff
 * discovery and pack-band design. Contract rates may still differ; flags explain cliffs.
 */

import { surfboardShippingDimIn } from "@/lib/shipping/surfboard-label-limits"

/** Length + girth above this triggers Large Package Surcharge. */
export const UPS_LARGE_PACKAGE_DIM_IN = 130

/** Longest side above this triggers Large Package Surcharge. */
export const UPS_LARGE_PACKAGE_MAX_LENGTH_IN = 96

/** Cubic inches above this triggers Large Package Surcharge (2026). */
export const UPS_LARGE_PACKAGE_VOLUME_IN3 = 17_280

/** Cubic inches above this triggers Additional Handling (2026 volume rule). */
export const UPS_ADDITIONAL_HANDLING_VOLUME_IN3 = 10_368

/** Actual weight above this triggers Large Package Surcharge (2026). */
export const UPS_LARGE_PACKAGE_WEIGHT_LB = 110

export type UpsParcelSurchargeFlags = {
  dimIn: number
  volumeIn3: number
  dimOver130: boolean
  lengthOver96: boolean
  volumeOver10368: boolean
  volumeOver17280: boolean
  weightOver110: boolean
  /** Any LPS trigger (dim, length, volume, or weight). */
  largePackageLikely: boolean
  /** AHC volume trigger — often superseded when LPS also applies. */
  additionalHandlingVolumeLikely: boolean
}

export function upsParcelCubicVolumeIn3(
  lengthIn: number,
  widthIn: number,
  heightIn: number,
): number {
  return lengthIn * widthIn * heightIn
}

export function upsParcelSurchargeFlags(input: {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}): UpsParcelSurchargeFlags {
  const dimIn = surfboardShippingDimIn(input.lengthIn, input.widthIn, input.heightIn)
  const volumeIn3 = upsParcelCubicVolumeIn3(input.lengthIn, input.widthIn, input.heightIn)
  const dimOver130 = dimIn > UPS_LARGE_PACKAGE_DIM_IN
  const lengthOver96 = input.lengthIn > UPS_LARGE_PACKAGE_MAX_LENGTH_IN
  const volumeOver10368 = volumeIn3 > UPS_ADDITIONAL_HANDLING_VOLUME_IN3
  const volumeOver17280 = volumeIn3 > UPS_LARGE_PACKAGE_VOLUME_IN3
  const weightOver110 = input.weightLb > UPS_LARGE_PACKAGE_WEIGHT_LB
  const largePackageLikely =
    dimOver130 || lengthOver96 || volumeOver17280 || weightOver110

  return {
    dimIn,
    volumeIn3,
    dimOver130,
    lengthOver96,
    volumeOver10368,
    volumeOver17280,
    weightOver110,
    largePackageLikely,
    additionalHandlingVolumeLikely: volumeOver10368 && !largePackageLikely,
  }
}
