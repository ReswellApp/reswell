/**
 * Magazines marketplace — `listings` rows with `section = 'magazines'`.
 */

export const MAGAZINES_SECTION = "magazines" as const

/** Fixed `categories.id` — must match `20260707120000_magazines_marketplace.sql`. */
export const USED_MAGAZINES_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000008"

/** Profile that owned legacy magazine listings before peer selling launched. */
export const MAGAZINE_LISTING_SELLER_EMAIL = "haydensbsb@gmail.com"

/** Default ship-from location for magazine listings without seller location on file. */
export const MAGAZINE_LISTING_DEFAULT_LOCATION = {
  city: "Santa Barbara",
  state: "CA",
  latitude: 34.4208,
  longitude: -119.6982,
} as const

/** Standard packed parcel for one magazine copy — not editable by sellers. */
export const MAGAZINE_STANDARD_PACKAGE_INCHES = {
  length: 12,
  width: 9,
  height: 1,
} as const

export const MAGAZINE_STANDARD_PACKAGE_WEIGHT_LB = 3

/** Sell-form strings for the fixed one-copy magazine parcel. */
export function magazineListingFixedReswellPackageFormFields(): {
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
} {
  return {
    reswellPackageLengthIn: String(MAGAZINE_STANDARD_PACKAGE_INCHES.length),
    reswellPackageWidthIn: String(MAGAZINE_STANDARD_PACKAGE_INCHES.width),
    reswellPackageHeightIn: String(MAGAZINE_STANDARD_PACKAGE_INCHES.height),
    reswellPackageWeightLb: String(MAGAZINE_STANDARD_PACKAGE_WEIGHT_LB),
    reswellPackageWeightOz: "0",
  }
}
