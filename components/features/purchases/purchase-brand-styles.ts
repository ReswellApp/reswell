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

/** Seller avatar placeholder. BRAND_LIGHT_BLUE wash, BRAND_DARK_BLUE icon. */
export const purchaseAvatarFallbackClassName =
  "bg-[#7F9DD5]/25 text-[#355185] dark:bg-[#7F9DD5]/20 dark:text-[#7F9DD5]"

/** Tracking row wash — light brand blue instead of generic indigo. */
export const purchaseTrackRowClassName = "bg-[#7F9DD5]/15 dark:bg-[#5574AD]/20"
