import {
  extractMarketplaceSectionIntent,
  isMarketplaceSectionOnlyQuery,
  marketplaceSectionBrowseHref,
} from "./marketplace-brand-query.ts"

export interface MarketplaceSearchRedirect {
  href: string
  /** 308 for empty `/search`; 307 for section/style browse hubs. */
  permanent: boolean
}

/**
 * URL-only `/search` redirects (no data fetch). Used by the edge proxy so
 * `loading.tsx` / Suspense cannot turn them into HTTP 200 + NEXT_REDIRECT.
 *
 * `resolveStyleHref` is injected so Node tests do not load `@/` style helpers.
 */
export function marketplaceSearchRedirect(
  input: {
    rawQuery: string
    brandSlug: string
    categorySlug: string
  },
  resolveStyleHref: (rawQuery: string) => string | null = () => null,
): MarketplaceSearchRedirect | null {
  const rawQuery = input.rawQuery.trim()
  const brandSlug = input.brandSlug.trim()
  const categorySlug = input.categorySlug.trim()

  if (!rawQuery && !brandSlug) {
    const sp = new URLSearchParams()
    if (categorySlug) sp.set("category", categorySlug)
    return {
      href: `/search/recent${sp.size ? `?${sp}` : ""}`,
      permanent: true,
    }
  }

  if (rawQuery && !brandSlug && isMarketplaceSectionOnlyQuery(rawQuery)) {
    const browseHref = marketplaceSectionBrowseHref(extractMarketplaceSectionIntent(rawQuery))
    if (browseHref) return { href: browseHref, permanent: false }
  }

  if (rawQuery && !brandSlug) {
    const styleHref = resolveStyleHref(rawQuery)
    if (styleHref) return { href: styleHref, permanent: false }
  }

  return null
}
