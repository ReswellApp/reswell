/**
 * Listing PDP hero frame (`/l/*`).
 *
 * The photo must stay visible without opening enlarge. Never force a 3:4
 * `object-cover` crop — Chrome / Google on iOS and tablet `md:` widths were
 * clipping nose and tail. Custom-property aspect-ratio must be slash-form
 * (`750 / 1000`); unitless values are ignored in those WebViews.
 */

export const DEFAULT_LISTING_HERO_ASPECT = 3 / 4

/** Hero `sizes` — `vw` not `svw`, which older iOS WebKit drops from the descriptor. */
export const LISTING_PDP_HERO_IMAGE_SIZES = "(max-width: 1024px) 100vw, 50vw"

/**
 * Slash-form CSS `aspect-ratio` (`750 / 1000`, not `0.75`).
 * iOS Chrome / Google app have ignored unitless custom-property values.
 */
export function listingHeroAspectCss(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "3 / 4"
  const width = Math.round(ratio * 1000)
  if (width <= 0) return "3 / 4"
  return `${width} / 1000`
}

export function listingHeroFrameVars(ratio: number): {
  "--listing-hero-aspect": string
} {
  return { "--listing-hero-aspect": listingHeroAspectCss(ratio) }
}

/** @deprecated Use {@link listingHeroFrameVars} */
export const listingMobileHeroFrameVars = listingHeroFrameVars
