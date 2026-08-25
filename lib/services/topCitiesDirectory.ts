import type { SupabaseClient } from "@supabase/supabase-js"
import { listActiveListingLocalities } from "@/lib/db/top-cities-listings"
import { isListingDiscoveryEligible } from "@/lib/listing-public-visibility"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  normalizePickupStateCode,
  pickupLocalityKey,
} from "@/lib/services/pickupOnlySurfboards"
import {
  cityLandingHref,
  cityNameSlug,
  publicCityLandingSlug,
} from "@/lib/city-landing-path"
import type { TopCitiesDirectory, TopCityDirectoryRow } from "@/lib/types/top-cities-directory"

function cityDirectoryLabel(city: string, state: string | null): string {
  const cityLabel = capitalizeWords(city)
  const stateLabel = normalizePickupStateCode(state)
  if (cityLabel && stateLabel) return `${cityLabel}, ${stateLabel}`
  return cityLabel
}

export function buildTopCitiesDirectory(
  rows: Awaited<ReturnType<typeof listActiveListingLocalities>>,
): TopCitiesDirectory {
  const buckets = new Map<
    string,
    { city: string; state: string | null; listingCount: number }
  >()

  for (const row of rows) {
    if (!isListingDiscoveryEligible(row)) continue
    const city = row.city?.trim() ?? ""
    if (!city) continue

    const state = normalizePickupStateCode(row.state?.trim() || null) || null
    const key = pickupLocalityKey(city, state)
    const existing = buckets.get(key)
    if (existing) {
      existing.listingCount += 1
      continue
    }
    buckets.set(key, {
      city: capitalizeWords(city),
      state,
      listingCount: 1,
    })
  }

  const bucketEntries = [...buckets.entries()]
  const cityNameCounts = new Map<string, number>()
  for (const [, bucket] of bucketEntries) {
    const nameSlug = cityNameSlug(bucket.city)
    if (!nameSlug) continue
    cityNameCounts.set(nameSlug, (cityNameCounts.get(nameSlug) ?? 0) + 1)
  }

  const cities: TopCityDirectoryRow[] = bucketEntries
    .map(([key, bucket]) => {
      const label = cityDirectoryLabel(bucket.city, bucket.state)
      const slug = publicCityLandingSlug(
        bucket.city,
        bucket.state,
        cityNameCounts.get(cityNameSlug(bucket.city)) ?? 0,
      )
      return {
        key,
        slug,
        label,
        city: bucket.city,
        state: bucket.state,
        listingCount: bucket.listingCount,
        href: cityLandingHref(slug),
      }
    })
    .sort((a, b) => {
      if (b.listingCount !== a.listingCount) return b.listingCount - a.listingCount
      return a.label.localeCompare(b.label)
    })

  return {
    cities,
    totalCities: cities.length,
    totalListings: cities.reduce((sum, city) => sum + city.listingCount, 0),
  }
}

export async function getTopCitiesDirectory(
  supabase: SupabaseClient,
): Promise<TopCitiesDirectory> {
  const rows = await listActiveListingLocalities(supabase)
  return buildTopCitiesDirectory(rows)
}
