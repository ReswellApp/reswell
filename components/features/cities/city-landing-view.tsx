"use client"

import { useMemo } from "react"
import type { StaticImageData } from "next/image"
import { useSearchParams } from "next/navigation"
import { BoardsBrowseClient } from "@/components/boards-browse-client"
import { CityLandingListings } from "@/components/features/cities/city-landing-listings"
import { CitySurfShopsRow } from "@/components/features/cities/city-surf-shops-row"
import { CityTopSellerListingsRow } from "@/components/features/cities/city-top-seller-listings-row"
import {
  cityLandingFacetCounts,
  filterCityListingsByBrowseParams,
} from "@/lib/city-landing-filters"
import { surfShopsForCity } from "@/lib/city-landing-surf-shops"
import { pickCityTopSellerListings } from "@/lib/city-landing-top-listings"
import type { CityLandingPageData } from "@/lib/types/city-landing"
import charlestonCoast from "@/public/images/cities/charleston-coast.jpg"
import kailuaLanikai from "@/public/images/cities/kailua-lanikai.jpg"
import losAngelesCoast from "@/public/images/cities/los-angeles-coast.jpg"
import malibuZuma from "@/public/images/cities/malibu-zuma.jpg"
import oceansidePier from "@/public/images/cities/oceanside-pier.jpg"
import sanDiegoBlacksBeach from "@/public/images/cities/san-diego-blacks-beach.jpg"
import sanFranciscoOceanBeach from "@/public/images/cities/san-francisco-ocean-beach.jpg"
import santaBarbaraMesaLane from "@/public/images/cities/santa-barbara-mesa-lane.jpg"
import venturaPier from "@/public/images/cities/ventura-pier.jpg"

type CityAtmosphere = {
  image: StaticImageData
  className: string
}

const CITY_ATMOSPHERE_BY_SLUG: Record<string, CityAtmosphere> = {
  charleston: {
    image: charlestonCoast,
    className: "object-[center_48%] md:object-[center_42%]",
  },
  kailua: {
    image: kailuaLanikai,
    className: "object-[center_62%] md:object-[center_55%]",
  },
  "los-angeles": {
    image: losAngelesCoast,
    className: "object-[center_62%] md:object-[center_58%]",
  },
  malibu: {
    image: malibuZuma,
    className: "object-[center_68%] md:object-[center_62%]",
  },
  oceanside: {
    image: oceansidePier,
    className: "object-[center_48%] md:object-[center_42%]",
  },
  "san-diego": {
    image: sanDiegoBlacksBeach,
    className: "object-[center_38%] md:object-[center_34%]",
  },
  "san-francisco": {
    image: sanFranciscoOceanBeach,
    className: "object-[center_42%] md:object-[center_38%]",
  },
  "santa-barbara": {
    image: santaBarbaraMesaLane,
    className: "object-[center_62%] md:object-[38%_55%]",
  },
  ventura: {
    image: venturaPier,
    className: "object-[center_48%] md:object-[center_42%]",
  },
}

const CITY_ATMOSPHERE_ALIASES: Record<string, string> = {
  "charleston-sc": "charleston",
  "los-angeles-ca": "los-angeles",
  "kailua-hi": "kailua",
  "malibu-ca": "malibu",
  "oceanside-ca": "oceanside",
  "san-diego-ca": "san-diego",
  "san-francisco-ca": "san-francisco",
  "santa-barbara-ca": "santa-barbara",
  "ventura-ca": "ventura",
}

function cityAtmosphere(city: CityLandingPageData["city"]): CityAtmosphere | undefined {
  const canonical = CITY_ATMOSPHERE_ALIASES[city.slug] ?? city.slug
  return (
    CITY_ATMOSPHERE_BY_SLUG[canonical] ??
    CITY_ATMOSPHERE_BY_SLUG[city.city.toLowerCase().replace(/\s+/g, "-")]
  )
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
  const surfShops = surfShopsForCity(city)
  const atmosphere = cityAtmosphere(city)
  const hasAfterHeader = topSellerListings.length > 0 || surfShops.length > 0

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
            hasAfterHeader ? (
              <>
                {topSellerListings.length > 0 ? (
                  <CityTopSellerListingsRow cityName={city.city} listings={topSellerListings} />
                ) : null}
                <CitySurfShopsRow cityName={city.city} shops={surfShops} />
              </>
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
