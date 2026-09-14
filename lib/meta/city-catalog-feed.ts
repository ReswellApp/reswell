/**
 * City landing markets synced to the dedicated Meta catalog feed
 * (`/api/integrations/meta/catalog-feed/cities`).
 * Location labels match city pages (`/reswell/santa-barbara`, `/reswell/ventura`).
 */
export const META_CITY_CATALOG_MARKETS = [
  {
    slug: "santa-barbara",
    name: "Santa Barbara",
    locationLabel: "Santa Barbara, CA",
    customLabel: "SantaBarbara",
    landingPath: "/reswell/santa-barbara",
    aliases: ["santa-barbara-ca"],
  },
  {
    slug: "ventura",
    name: "Ventura",
    locationLabel: "Ventura, CA",
    customLabel: "Ventura",
    landingPath: "/reswell/ventura",
    aliases: ["ventura-ca"],
  },
] as const

export type MetaCityCatalogMarket = (typeof META_CITY_CATALOG_MARKETS)[number]
export type MetaCityCatalogSlug = MetaCityCatalogMarket["slug"]

export function metaCityCatalogLandingHref(slug: MetaCityCatalogSlug): string {
  const market = META_CITY_CATALOG_MARKETS.find((row) => row.slug === slug)
  return market?.landingPath ?? `/reswell/${slug}`
}

export function findMetaCityCatalogMarket(rawSlug: string): MetaCityCatalogMarket | null {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) return null
  return (
    META_CITY_CATALOG_MARKETS.find(
      (market) => market.slug === slug || market.aliases.some((alias) => alias === slug),
    ) ?? null
  )
}

export function resolveMetaCityCatalogMarkets(
  rawSlug: string | null | undefined,
): MetaCityCatalogMarket[] | null {
  if (rawSlug == null || rawSlug.trim() === "") {
    return [...META_CITY_CATALOG_MARKETS]
  }
  const market = findMetaCityCatalogMarket(rawSlug)
  return market ? [market] : null
}
