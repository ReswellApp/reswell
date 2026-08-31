import type { RecentListing } from "@/components/recent-feed-client"
import type { CityTopSeller } from "@/lib/types/city-top-sellers"
import type { TopCityDirectoryRow } from "@/lib/types/top-cities-directory"

export type CityLandingListing = RecentListing & {
  brand?: string | null
  model?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  dimensions?: string | null
}

export type CityLandingPageData = {
  city: TopCityDirectoryRow
  listings: CityLandingListing[]
  topSellers: CityTopSeller[]
  pickupCount: number
  hasMore: boolean
  boardsBrowseHref: string
}
