/**
 * Listing PDP hero frame — mobile Chrome / Google app on iOS (WKWebView).
 *
 * Those apps keep a persistent toolbar, so `58dvh` is shorter than Safari’s
 * collapsed-chrome viewport. A full-width 3:4 box then overflows the cap;
 * WebKit does not shrink width when `min-width: 100%` is set, and `object-cover`
 * crops the nose and tail. Custom-property fallbacks like
 * `aspect-ratio: var(--x, 3/4)` are also unreliable there (unitless values and
 * Tailwind commas).
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

export function listingMobileHeroFrameVars(ratio: number): {
  "--listing-hero-aspect": string
} {
  return { "--listing-hero-aspect": listingHeroAspectCss(ratio) }
}
