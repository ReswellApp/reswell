"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { BoardsBrowseClient } from "@/components/boards-browse-client"
import { CityLandingListings } from "@/components/features/cities/city-landing-listings"
import { CityTopSellerListingsRow } from "@/components/features/cities/city-top-seller-listings-row"
import {
  cityLandingFacetCounts,
  filterCityListingsByBrowseParams,
} from "@/lib/city-landing-filters"
import { pickCityTopSellerListings } from "@/lib/city-landing-top-listings"
import type { CityLandingPageData } from "@/lib/types/city-landing"
import santaBarbaraMesaLane from "@/public/images/cities/santa-barbara-mesa-lane.jpg"

function isSantaBarbara(city: CityLandingPageData["city"]): boolean {
  return city.slug === "santa-barbara" || city.city.toLowerCase() === "santa barbara"
}

export function CityLandingView({ data }: { data: CityLandingPageData }) {
  const { city, listings } = data
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  const visible = useMemo(
    () => filterCityListingsByBrowseParams(listings, new URLSearchParams(query)),
    [listings, query],
  )
  const counts = useMemo(
    () => cityLandingFacetCounts(listings, new URLSearchParams(query)),
    [listings, query],
  )
  const topSellerListings = useMemo(() => pickCityTopSellerListings(listings), [listings])
  const santaBarbara = isSantaBarbara(city)

  return (
    <section className="bg-offwhite">
      <div className="container mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10">
        <BoardsBrowseClient
          counts={counts}
          title={`${city.city} Used Surfboards`}
          atmosphere={santaBarbara}
          atmosphereImage={santaBarbara ? santaBarbaraMesaLane : undefined}
          atmosphereImageClassName={
            santaBarbara ? "object-[center_62%] md:object-[38%_55%]" : undefined
          }
          showHoverBarListBoard
          afterHeader={
            topSellerListings.length > 0 ? (
              <CityTopSellerListingsRow cityName={city.city} listings={topSellerListings} />
            ) : null
          }
        >
          <CityLandingListings
            key={`${city.slug}-${query}`}
            listings={visible}
            emptyMessage={
              listings.length === 0
                ? `No live surfboards in ${city.label} right now. List one of yours — it's free.`
                : "No boards match those filters. Clear a filter to see more."
            }
          />
        </BoardsBrowseClient>
      </div>
    </section>
  )
}
