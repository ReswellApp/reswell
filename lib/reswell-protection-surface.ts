/**
 * Shared Purchase Protection UI surface (listing PDP ribbons, checkout, policy page, footer).
 * #7F9DD5 tint with light opacity — keep in sync when adjusting brand protection styling.
 */
export const reswellProtectionBorderAndBg =
  "border-[#7F9DD5]/25 bg-[#7F9DD5]/15 dark:border-[#7F9DD5]/35 dark:bg-[#7F9DD5]/18"

/** Full card / pill: border width + tint classes. */
export const reswellProtectionCardClassName = `border ${reswellProtectionBorderAndBg}`

/** Left rule between columns in `ListingProtectionTrustRibbon` (desktop). */
export const reswellProtectionTrustRibbonColumnDividerClassName =
  "sm:border-l sm:border-[#7F9DD5]/25 sm:pl-4 dark:sm:border-[#7F9DD5]/35"

/** Circular hero icon well on the protection policy page. */
export const reswellProtectionIconWellClassName =
  "bg-[#7F9DD5]/20 dark:bg-[#7F9DD5]/25"
