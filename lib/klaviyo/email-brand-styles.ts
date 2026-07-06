/**
 * Klaviyo email styling — mirrors Reswell site tokens from `lib/brand-colors.ts`
 * and `tailwind.config.ts` (no ad-hoc blues/greens).
 *
 * Fonts: Stack Sans is loaded via next/font on the site; email clients fall back to
 * Arial (same as `adjustFontFallback: 'Arial'` in `app/layout.tsx`).
 */

import {
  BRAND_CTA_BLUE,
  BRAND_CTA_BLUE_HOVER,
  BRAND_DEEP_BLUE,
  BRAND_NEAR_BLACK,
  BRAND_WHITE,
} from "@/lib/brand-colors"

/** Body / UI — Stack Sans Text fallback stack. */
export const KLAVIYO_EMAIL_FONT_SANS = "Arial, Helvetica, sans-serif"

/** Listing titles — Stack Sans Headline fallback stack. */
export const KLAVIYO_EMAIL_FONT_HEADLINE = KLAVIYO_EMAIL_FONT_SANS

/** Tailwind `midgray` / `muted.foreground`. */
export const KLAVIYO_EMAIL_MUTED = "#64748B"

/** Tailwind `lightgray` / `border`. */
export const KLAVIYO_EMAIL_BORDER = "#E2E8F0"

/** Site `--radius` (0.5rem). */
export const KLAVIYO_EMAIL_RADIUS = "8px"

/** Checkout / cart primary buttons use 6px on checkout; 8px on cart — use 8px in email. */
export const KLAVIYO_EMAIL_BUTTON_RADIUS = "8px"

/** Klaviyo audit minimums (accessibility / design system). */
export const KLAVIYO_EMAIL_BODY_FONT_SIZE = "16px"
export const KLAVIYO_EMAIL_BUTTON_FONT_SIZE = "16px"
export const KLAVIYO_EMAIL_LINK_FONT_SIZE = "16px"

/** Inset from the 600px email column on left and right. */
export const KLAVIYO_EMAIL_HORIZONTAL_PADDING = "32px"

export const KLAVIYO_EMAIL_COLORS = {
  foreground: BRAND_NEAR_BLACK,
  price: BRAND_DEEP_BLUE,
  priceDrop: BRAND_DEEP_BLUE,
  link: BRAND_CTA_BLUE,
  linkHover: BRAND_CTA_BLUE_HOVER,
  buttonBg: BRAND_CTA_BLUE,
  buttonBgHover: BRAND_CTA_BLUE_HOVER,
  buttonText: BRAND_WHITE,
  muted: KLAVIYO_EMAIL_MUTED,
  border: KLAVIYO_EMAIL_BORDER,
  background: BRAND_WHITE,
} as const
