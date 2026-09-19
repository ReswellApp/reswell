import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import {
  matchLocationToCityLanding,
  type LocationToCityQuery,
} from "@/lib/services/matchLocationToCityLanding"

export type ResolvedCityLanding = {
  slug: string
  href: string
  label: string
}

export async function resolveCityLandingFromLocation(
  query: LocationToCityQuery,
): Promise<ResolvedCityLanding | null> {
  const directory = await getCachedTopCitiesDirectory()
  const match = matchLocationToCityLanding(query, directory.cities)
  if (!match) return null
  return {
    slug: match.slug,
    href: match.href,
    label: match.label,
  }
}
