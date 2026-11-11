/**
 * Purchase list and detail accents — Reswell brand palette (`lib/brand-colors.ts`).
 * Tailwind JIT requires the hex literals to stay in these class strings.
 */

/** Prices, totals, and completed timeline titles. BRAND_CTA_BLUE / BRAND_LIGHT_BLUE */
export const purchaseAccentTextClassName = "text-[#5574AD] dark:text-[#7F9DD5]"

/** “More details” and other text links. */
export const purchaseAccentLinkClassName =
  "text-[#5574AD] hover:underline dark:text-[#7F9DD5]"

/** Search field border and focus ring. BRAND_CTA_BLUE, BRAND_LIGHT_BLUE in dark mode. */
export const purchaseSearchFieldClassName =
  "border-[#5574AD] focus-visible:border-[#5574AD] focus-visible:ring-[#5574AD]/25 dark:border-[#7F9DD5] dark:focus-visible:border-[#7F9DD5] dark:focus-visible:ring-[#7F9DD5]/25"

/** Tracking row wash — light brand blue instead of generic indigo. */
export const purchaseTrackRowClassName = "bg-[#7F9DD5]/15 dark:bg-[#5574AD]/20"

/** Pickup-code banner. Footer blue (`listingHeart`) at low opacity. */
export const pickupCodeBannerSurfaceClassName =
  "border-listingHeart/30 bg-listingHeart/[0.08] dark:bg-listingHeart/15"

export const pickupCodeBannerLabelClassName = "text-listingHeart dark:text-listingHeart/90"
