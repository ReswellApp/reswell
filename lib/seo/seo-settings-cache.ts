/** Cache tag for the singleton SEO settings (robots.txt + sitemap overrides). */
export const SEO_SETTINGS_CACHE_TAG = "seo-settings"

export interface SeoSettingsValues {
  discourageAllCrawlers: boolean
  extraDisallow: string[]
  extraAllow: string[]
  crawlDelay: number | null
  extraSitemaps: string[]
  /** Site-wide favicon URL (public). Null falls back to the framework/browser default. */
  faviconUrl: string | null
  /** Apple touch icon URL (180×180 PNG recommended). */
  appleIconUrl: string | null
}

export const DEFAULT_SEO_SETTINGS: SeoSettingsValues = {
  discourageAllCrawlers: false,
  extraDisallow: [],
  extraAllow: [],
  crawlDelay: null,
  extraSitemaps: [],
  faviconUrl: null,
  appleIconUrl: null,
}
