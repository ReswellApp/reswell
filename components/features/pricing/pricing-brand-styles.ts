/**
 * Model pricing page tokens — Reswell brand palette only (`lib/brand-colors.ts`).
 * Tailwind JIT requires the hex literals to stay in these class strings.
 */

/** Page canvas — BRAND_OFF_WHITE */
export const pricingPageClassName =
  "flex-1 bg-[#F9F9F2] text-[#163060] dark:bg-background dark:text-foreground"

/** Cards — BRAND_WHITE / BRAND_DARK_BLUE hairline */
export const pricingCardClassName =
  "rounded-2xl border border-[#355185]/15 bg-white shadow-[0_1px_2px_rgba(4,7,14,0.04)] dark:border-border dark:bg-card"

/** Titles — BRAND_NEAR_BLACK */
export const pricingTitleClassName = "text-[#04070E] dark:text-foreground"

/** Body / identity copy — BRAND_DEEP_BLUE */
export const pricingBodyClassName = "text-[#163060] dark:text-foreground"

/** Muted labels, breadcrumbs, empty states — BRAND_DARK_BLUE */
export const pricingMutedClassName = "text-[#355185]/70"

/** Breadcrumb separators — BRAND_DARK_BLUE */
export const pricingChevronClassName = "h-3.5 w-3.5 text-[#355185]/50"

/** Breadcrumb link hover — BRAND_DEEP_BLUE */
export const pricingCrumbHoverClassName = "hover:text-[#163060] dark:hover:text-foreground"

/** Category + live-listing links — BRAND_CTA_BLUE / BRAND_LIGHT_BLUE */
export const pricingLinkClassName =
  "font-medium text-[#5574AD] hover:underline dark:text-[#7F9DD5]"

/** Avg / median figures — BRAND_CTA_BLUE / BRAND_LIGHT_BLUE */
export const pricingStatValueClassName = "text-[#5574AD] dark:text-[#7F9DD5]"

/** Image placeholders — BRAND_DARK_BLUE tint */
export const pricingThumbClassName = "bg-[#355185]/15 dark:bg-muted"

/** Sale-row hover — BRAND_OFF_WHITE */
export const pricingRowHoverClassName = "hover:bg-[#F9F9F2] dark:hover:bg-white/5"

/** Dividers — BRAND_DARK_BLUE hairline */
export const pricingDividerClassName = "border-[#355185]/15 dark:border-border"

/** Primary CTA — BRAND_CTA_BLUE / BRAND_CTA_BLUE_HOVER */
export const pricingBuyClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-[#5574AD] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#466091] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/40 focus-visible:ring-offset-2"

/** Secondary — BRAND_LIGHT_BLUE wash */
export const pricingListingsClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7F9DD5]/20 px-5 text-[15px] font-semibold text-[#163060] transition-colors hover:bg-[#7F9DD5]/40 dark:bg-[#5574AD]/15 dark:text-foreground dark:hover:bg-[#5574AD]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/40 focus-visible:ring-offset-2"

/** Outline — BRAND_CTA_BLUE */
export const pricingSellClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-[#5574AD] bg-white px-5 text-[15px] font-semibold text-[#5574AD] transition-colors hover:bg-[#5574AD]/5 dark:bg-transparent dark:hover:bg-[#5574AD]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/40 focus-visible:ring-offset-2"

/** Tertiary — BRAND_DARK_BLUE wash */
export const pricingAllModelsClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-[#355185]/15 bg-[#355185]/15 px-5 text-[15px] font-semibold text-[#163060] transition-colors hover:bg-[#355185]/20 dark:border-white/15 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/40 focus-visible:ring-offset-2"
