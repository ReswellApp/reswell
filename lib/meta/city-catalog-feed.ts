import { usStateTitleCaseName } from "../us-state-name-to-code.ts"

/**
 * City landing markets synced to Meta catalog `custom_label_1`
 * (main feed + `/api/integrations/meta/catalog-feed/cities`).
 * Location labels match city pages (`/reswell/santa-barbara`, `/reswell/ventura`).
 */
export const META_CITY_CATALOG_MARKETS = [
  {
    slug: "santa-barbara",
    name: "Santa Barbara",
    locationLabel: "Santa Barbara, CA",
    customLabel: "SantaBarbara",
    stateCode: "CA",
    landingPath: "/reswell/santa-barbara",
    aliases: ["santa-barbara-ca"],
  },
  {
    slug: "ventura",
    name: "Ventura",
    locationLabel: "Ventura, CA",
    customLabel: "Ventura",
    stateCode: "CA",
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

function listingStateMatchesMarket(
  listingState: string | null | undefined,
  stateCode: string,
): boolean {
  const raw = listingState?.trim()
  if (!raw) return false
  if (raw.toUpperCase() === stateCode) return true
  const name = usStateTitleCaseName(stateCode)
  return Boolean(name && raw.toLowerCase().includes(name.toLowerCase()))
}

/**
 * `custom_label_1` for a listing on the main Meta catalog feed.
 * Same city + state match as `/reswell/santa-barbara` and `/reswell/ventura`.
 */
export function metaCityCustomLabelForListing(
  city: string | null | undefined,
  state: string | null | undefined,
): string | undefined {
  const listingCity = city?.trim()
  if (!listingCity) return undefined

  const cityNorm = listingCity.toLowerCase()

  for (const market of META_CITY_CATALOG_MARKETS) {
    if (!cityNorm.includes(market.name.toLowerCase())) continue
    if (!listingStateMatchesMarket(state, market.stateCode)) continue
    return market.customLabel
  }

  return undefined
}
