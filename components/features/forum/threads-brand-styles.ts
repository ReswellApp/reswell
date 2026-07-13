/**
 * Threads UI color tokens — Reswell brand palette only (`lib/brand-colors.ts`).
 * Tailwind JIT requires literal hex in class strings.
 */

/** Page canvas — BRAND_OFF_WHITE */
export const threadsPageBgClassName = "bg-[#F9F9F2] dark:bg-background"

/** Sub-nav, table headers — BRAND_DARK_BLUE */
export const threadsSurfaceClassName = "bg-[#355185]"

/** Sub-nav loading skeleton */
export const threadsSurfaceMutedClassName = "bg-[#355185]/60"

/** Primary CTA — BRAND_CTA_BLUE / BRAND_CTA_BLUE_HOVER */
export const threadsCtaClassName =
  "bg-[#5574AD] shadow-sm hover:bg-[#466091]"

/** Emphasis text (stats, likes) — BRAND_CTA_BLUE */
export const threadsAccentTextClassName = "font-semibold text-[#5574AD]"

/** Live presence indicator — BRAND_CTA_BLUE / BRAND_LIGHT_BLUE */
export const threadsPresencePingClassName = "bg-[#7F9DD5]/70"
export const threadsPresenceDotClassName = "bg-[#5574AD]"

/** Avatar fallback — BRAND_LIGHT_BLUE / BRAND_DARK_BLUE */
export const threadsAvatarFallbackClassName =
  "bg-[#7F9DD5]/25 font-semibold text-[#355185]"

/** Like count badge — BRAND_CTA_BLUE tint */
export const threadsLikeBadgeClassName =
  "bg-[#5574AD]/10 dark:bg-[#5574AD]/20"

/** Category / section marker — BRAND_CTA_BLUE */
export const threadsMarkerClassName = "bg-[#5574AD]"

/** Liked state — BRAND_CTA_BLUE */
export const threadsLikedClassName = "text-[#5574AD] hover:text-[#5574AD]"

/** Character-count warning — BRAND_DEEP_BLUE / BRAND_LIGHT_BLUE */
export const threadsWarningTextClassName =
  "font-medium text-[#163060] dark:text-[#7F9DD5]"

/** Success hint — BRAND_CTA_BLUE */
export const threadsSuccessTextClassName = "text-xs font-medium text-[#5574AD]"

/** Destructive actions — BRAND_NEAR_BLACK / BRAND_LIGHT_BLUE */
export const threadsDestructiveClassName =
  "text-[#04070E] hover:text-[#04070E] dark:text-[#7F9DD5] dark:hover:text-[#7F9DD5]"

/** Rating stars — BRAND_CTA_BLUE */
export const threadsStarFilledClassName =
  "fill-[#5574AD] stroke-none text-[#5574AD]"

export const threadsStarEmptyClassName =
  "fill-[#5574AD]/20 stroke-none text-[#5574AD]/20 dark:fill-[#5574AD]/26 dark:text-[#5574AD]/26"
