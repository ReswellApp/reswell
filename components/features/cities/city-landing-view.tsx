"use client"

import { useMemo } from "react"
import type { StaticImageData } from "next/image"
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
import charlestonCoast from "@/public/images/cities/charleston-coast.jpg"
import losAngelesCoast from "@/public/images/cities/los-angeles-coast.jpg"
import santaBarbaraMesaLane from "@/public/images/cities/santa-barbara-mesa-lane.jpg"

type CityAtmosphere = {
  image: StaticImageData
  className: string
}

function cityAtmosphere(city: CityLandingPageData["city"]): CityAtmosphere | undefined {
  const slug = city.slug
  const name = city.city.toLowerCase()

  if (slug === "santa-barbara" || name === "santa barbara") {
    return {
      image: santaBarbaraMesaLane,
      className: "object-[center_62%] md:object-[38%_55%]",
    }
  }

  if (slug === "charleston" || slug === "charleston-sc" || name === "charleston") {
    return {
      image: charlestonCoast,
      className: "object-[center_48%] md:object-[center_42%]",
    }
  }

  if (slug === "los-angeles" || slug === "los-angeles-ca" || name === "los angeles") {
    return {
      image: losAngelesCoast,
      className: "object-[center_62%] md:object-[center_58%]",
    }
  }

  return undefined
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
  const atmosphere = cityAtmosphere(city)

  return (
    <section className="bg-offwhite">
      <div className="container mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10">
        <BoardsBrowseClient
          counts={counts}
          title={`${city.city} Used Surfboards`}
          atmosphere={Boolean(atmosphere)}
          atmosphereImage={atmosphere?.image}
          atmosphereImageClassName={atmosphere?.className}
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
