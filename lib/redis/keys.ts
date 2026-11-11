import { createHash } from "node:crypto"

export const REDIS_TTL_SECONDS = {
  searchSuggest: 60,
  searchResults: 90,
  mobileSearch: 60,
  mobileListing: 45,
  mobileListingRails: 45,
  placesSuggest: 300,
  geocodeSuggest: 3600,
  forwardGeocode: 3600,
  shippingRates: 300,
  carrierIds: 600,
} as const

export function fingerprintCacheKey(material: string): string {
  return createHash("sha256").update(material).digest("hex").slice(0, 32)
}

function compactQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function redisRateLimitKey(scope: string, id: string): string {
  return `rl:${scope}:${id}`
}

export function redisSearchSuggestKey(section: string, query: string): string {
  return `cache:search:suggest:v1:${section}:${compactQuery(query)}`
}

export function redisMobileTypeaheadKey(query: string): string {
  return `cache:search:mobile-typeahead:v1:${compactQuery(query)}`
}

export function redisMobileResultsKey(query: string): string {
  return `cache:search:mobile-results:v1:${compactQuery(query)}`
}

export function redisSearchResultsKey(fingerprint: string): string {
  return `cache:search:results:v1:${fingerprint}`
}

export function redisPlacesSuggestKey(query: string): string {
  return `cache:geo:places:v1:${compactQuery(query)}`
}

export function redisPlaceDetailsKey(placeId: string): string {
  return `cache:geo:place-details:v1:${placeId.trim()}`
}

export function redisGeocodeSuggestKey(query: string, detailFull: boolean): string {
  return `cache:geo:suggest:v1:${detailFull ? "full" : "city"}:${compactQuery(query)}`
}

export function redisForwardGeocodeKey(place: string): string {
  return `cache:geo:forward:v1:${compactQuery(place)}`
}

export function redisZipLookupKey(zip: string): string {
  return `cache:geo:zip:v1:${zip.replace(/\D/g, "").slice(0, 5)}`
}

export function redisShippingRatesKey(hash: string): string {
  return `cache:ship:rates:v1:${hash}`
}

export const REDIS_CARRIER_IDS_KEY = "cache:ship:carriers:v1"

function listingParamKey(param: string): string {
  return param.trim().toLowerCase()
}

export function redisMobileListingKey(param: string): string {
  return `cache:mobile:listing:v1:${listingParamKey(param)}`
}

export function redisMobileListingRailsKey(param: string): string {
  return `cache:mobile:listing-rails:v1:${listingParamKey(param)}`
}

/** UUID + slug aliases so either URL shape expires together. */
export function redisMobileListingCacheKeys(listingId: string, slug?: string | null): string[] {
  const keys = [redisMobileListingKey(listingId), redisMobileListingRailsKey(listingId)]
  const trimmedSlug = typeof slug === "string" ? slug.trim() : ""
  if (trimmedSlug && trimmedSlug.toLowerCase() !== listingId.trim().toLowerCase()) {
    keys.push(redisMobileListingKey(trimmedSlug), redisMobileListingRailsKey(trimmedSlug))
  }
  return keys
}
