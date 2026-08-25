"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { MapPin } from "lucide-react"
import { BoardsBrowseClient } from "@/components/boards-browse-client"
import { CityLandingListings } from "@/components/features/cities/city-landing-listings"
import { ListYourSurfboardSellCta } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import {
  cityLandingFacetCounts,
  filterCityListingsByBrowseParams,
} from "@/lib/city-landing-filters"
import type { CityLandingPageData } from "@/lib/types/city-landing"

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

  return (
    <>
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5574AD]">
            Local pickup in {city.city}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-balance text-[#001A4A] sm:text-5xl">
            {city.city} Used Surfboards
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            List your board for free — no selling fees. Buy from locals and pick up in{" "}
            {city.city}.
          </p>
          <div className="mt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-foreground">
              <MapPin className="h-3.5 w-3.5 text-[#5574AD]" aria-hidden />
              {listings.length === 1
                ? "1 surfboard"
                : `${listings.length.toLocaleString()} surfboards`}
            </span>
          </div>
          <div className="mt-8">
            <ListYourSurfboardSellCta size="default" className="rounded-full">
              List a board in {city.city}
            </ListYourSurfboardSellCta>
          </div>
          {isSantaBarbara(city) ? (
            <MadeWithLoveSantaBarbara variant="light" className="mt-6 justify-start" />
          ) : null}
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <BoardsBrowseClient
            counts={counts}
            title="Find your next board"
            description={
              visible.length === listings.length
                ? `Shop local pickup in ${city.city}. Listing is free.`
                : `${visible.length.toLocaleString()} board${visible.length === 1 ? "" : "s"} match`
            }
            atmosphere={false}
            hideLocation
            hideShipToMe
            showSaveSearch={false}
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
    </>
  )
}
