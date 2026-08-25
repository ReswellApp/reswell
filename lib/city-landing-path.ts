import { slugify } from "@/lib/slugify"

/** Public city landing pages live under `/reswell/{slug}` (e.g. `/reswell/santa-barbara`). */
export const CITY_LANDING_BASE = "/reswell"

/** Slugs that cannot be city landing pages — static routes win these paths. */
export const RESERVED_CITY_LANDING_SLUGS = new Set(["shop", "top"])

export const CITY_LANDING_PAGE_SIZE = 48
export const CITY_LANDING_LISTING_CAP = 200

export function cityLandingHref(slug: string): string {
  return `${CITY_LANDING_BASE}/${slug}`
}

export function cityNameSlug(city: string): string {
  return slugify(city)
}

export function cityStateSlug(city: string, state: string | null): string {
  return slugify(state ? `${city} ${state}` : city)
}

/**
 * Prefer a short city slug (`santa-barbara`) when it is unique and not reserved.
 * Otherwise use city + state (`springfield-il`).
 */
export function publicCityLandingSlug(
  city: string,
  state: string | null,
  cityNameSlugCount: number,
): string {
  const nameSlug = cityNameSlug(city)
  const fullSlug = cityStateSlug(city, state)
  if (!nameSlug) return fullSlug
  if (RESERVED_CITY_LANDING_SLUGS.has(nameSlug) || cityNameSlugCount > 1) {
    return fullSlug || nameSlug
  }
  return nameSlug
}

export function boardsBrowseLocationHref(label: string): string {
  return `/boards?location=${encodeURIComponent(label)}`
}

type CitySlugFields = {
  slug: string
  city: string
  state: string | null
}

/** Resolve a public or alias slug (`santa-barbara` or `santa-barbara-ca`) to a directory city. */
export function findCityByLandingSlug<T extends CitySlugFields>(
  cities: readonly T[],
  rawSlug: string,
): T | null {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug || RESERVED_CITY_LANDING_SLUGS.has(slug)) return null

  const exact = cities.find((city) => city.slug === slug)
  if (exact) return exact

  const byFull = cities.find((city) => cityStateSlug(city.city, city.state) === slug)
  if (byFull) return byFull

  const byName = cities.filter((city) => cityNameSlug(city.city) === slug)
  if (byName.length === 1) return byName[0] ?? null

  return null
}
