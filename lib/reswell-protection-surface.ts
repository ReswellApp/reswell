/**
 * Shared Purchase Protection UI surface (listing PDP ribbons, checkout, policy page, footer).
 * Brand blues only — see palette in lib/brand-colors.ts. Keep opacities in sync across surfaces.
 */

/** Buyer / primary protection tint — #7F9DD5 */
export const reswellProtectionBorderAndBg =
  "border-[#7F9DD5]/25 bg-[#7F9DD5]/15 dark:border-[#7F9DD5]/35 dark:bg-[#7F9DD5]/18"

/** Seller protection tint — #5574AD */
export const reswellProtectionSellerBorderAndBg =
  "border-[#5574AD]/25 bg-[#5574AD]/10 dark:border-[#5574AD]/35 dark:bg-[#5574AD]/15"

/** Icon / check accent on buyer-tinted surfaces */
export const reswellProtectionAccentClassName = "text-[#5574AD] dark:text-[#7F9DD5]"

/** Icon / check accent on seller-tinted surfaces */
export const reswellProtectionSellerAccentClassName = "text-[#355185] dark:text-[#7F9DD5]"

/** Full card / pill: border width + tint classes. */
export const reswellProtectionCardClassName = `border ${reswellProtectionBorderAndBg}`

/** Left rule between columns in `ListingProtectionTrustRibbon` (desktop). */
export const reswellProtectionTrustRibbonColumnDividerClassName =
  "sm:border-l sm:border-[#7F9DD5]/25 sm:pl-4 dark:sm:border-[#7F9DD5]/35"
