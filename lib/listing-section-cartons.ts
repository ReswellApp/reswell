import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"

/**
 * Packed carton owned by one marketplace section.
 * Surfboards use `shipping_package_tier` / pack bands instead of this table.
 */
export type ListingSectionCarton = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightOz: number
}

type GearListingSection = Exclude<PeerListingSection, "surfboards">

/**
 * Default outer box for each non-surfboard section.
 * Fins keep the dedicated 10×7×4 box; other gear matches the shop Small / Medium / Large
 * mailers so a category has a carton even when the seller never picked a shop preset.
 */
export const LISTING_SECTION_DEFAULT_CARTONS: Record<GearListingSection, ListingSectionCarton> = {
  fins: { lengthIn: 10, widthIn: 7, heightIn: 4, weightOz: 48 },
  leashes: { lengthIn: 12, widthIn: 10, heightIn: 4, weightOz: 32 },
  traction: { lengthIn: 12, widthIn: 10, heightIn: 4, weightOz: 32 },
  magazines: { lengthIn: 12, widthIn: 10, heightIn: 4, weightOz: 32 },
  accessories: { lengthIn: 12, widthIn: 10, heightIn: 4, weightOz: 32 },
  apparel: { lengthIn: 18, widthIn: 14, heightIn: 6, weightOz: 48 },
  wetsuits: { lengthIn: 18, widthIn: 14, heightIn: 6, weightOz: 48 },
  boardbags: { lengthIn: 36, widthIn: 16, heightIn: 8, weightOz: 96 },
  surfpacks: { lengthIn: 36, widthIn: 16, heightIn: 8, weightOz: 96 },
}

/** Packed length above the small-parcel ceiling is a leftover surfboard carton. */
export const LISTING_SECTION_SMALL_PARCEL_MAX_LENGTH_IN = 48

export function listingSectionUsesSurfboardCarton(
  section: string | null | undefined,
): boolean {
  return section?.trim() === "surfboards"
}

export function defaultListingSectionCarton(
  section: string | null | undefined,
): ListingSectionCarton | null {
  const trimmed = section?.trim()
  if (!trimmed || listingSectionUsesSurfboardCarton(trimmed) || !isPeerListingSection(trimmed)) {
    return null
  }
  return LISTING_SECTION_DEFAULT_CARTONS[trimmed]
}

export function defaultListingSectionCartonColumns(section: string | null | undefined): {
  shipping_packed_length_in: number
  shipping_packed_width_in: number
  shipping_packed_height_in: number
  shipping_packed_weight_oz: number
  shipping_package_tier: null
  shipping_package_band: null
} | null {
  const carton = defaultListingSectionCarton(section)
  if (!carton) return null
  return {
    shipping_packed_length_in: carton.lengthIn,
    shipping_packed_width_in: carton.widthIn,
    shipping_packed_height_in: carton.heightIn,
    shipping_packed_weight_oz: carton.weightOz,
    shipping_package_tier: null,
    shipping_package_band: null,
  }
}

export function listingSectionCartonFormFields(section: string | null | undefined): {
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
} | null {
  const carton = defaultListingSectionCarton(section)
  if (!carton) return null
  const lb = Math.floor(carton.weightOz / 16)
  const oz = Math.round((carton.weightOz - lb * 16) * 100) / 100
  return {
    reswellPackageLengthIn: String(carton.lengthIn),
    reswellPackageWidthIn: String(carton.widthIn),
    reswellPackageHeightIn: String(carton.heightIn),
    reswellPackageWeightLb: String(lb),
    reswellPackageWeightOz: String(oz),
  }
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim()
}

/** True when the seller has not entered any packed L×W×H or weight yet. */
export function listingSectionPackageFieldsAllBlank(fields: {
  reswellPackageLengthIn?: string
  reswellPackageWidthIn?: string
  reswellPackageHeightIn?: string
  reswellPackageWeightLb?: string
  reswellPackageWeightOz?: string
}): boolean {
  return (
    isBlank(fields.reswellPackageLengthIn) &&
    isBlank(fields.reswellPackageWidthIn) &&
    isBlank(fields.reswellPackageHeightIn) &&
    isBlank(fields.reswellPackageWeightLb) &&
    isBlank(fields.reswellPackageWeightOz)
  )
}
