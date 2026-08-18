"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { TopCityDirectoryRow } from "@/lib/types/top-cities-directory"
import { cn } from "@/lib/utils"

type TopCitiesDirectoryProps = {
  cities: TopCityDirectoryRow[]
}

function listingsLabel(count: number): string {
  return count === 1 ? "1 listing" : `${count.toLocaleString()} listings`
}

export function TopCitiesDirectory({ cities }: TopCitiesDirectoryProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()

  const rankByKey = useMemo(
    () => new Map(cities.map((city, index) => [city.key, index + 1])),
    [cities],
  )

  const visibleCities = useMemo(() => {
    if (!normalizedQuery) return cities
    return cities.filter((city) => {
      const haystack = `${city.label} ${city.city} ${city.state ?? ""}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [cities, normalizedQuery])

  return (
    <section className="bg-background" aria-labelledby="top-cities-grid-heading">
      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="top-cities-grid-heading"
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              Cities with listings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {normalizedQuery
                ? `${visibleCities.length} cit${visibleCities.length === 1 ? "y" : "ies"} match “${query.trim()}”`
                : "Sorted by how many boards and gear are listed there now."}
            </p>
          </div>
          <label className="relative w-full sm:max-w-xs">
            <span className="sr-only">Search cities</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cities…"
              className="h-11 rounded-full pl-9"
            />
          </label>
        </div>

        {visibleCities.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <MapPin className="h-7 w-7 text-muted-foreground" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No cities found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {normalizedQuery
                ? "Try a different city or state name."
                : "Check back soon as more listings go live."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {visibleCities.map((city, index) => (
              <li key={city.key}>
                <Link
                  href={city.href}
                  className="group flex h-full items-start justify-between gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-soft transition-colors hover:border-foreground/20 hover:shadow-soft-hover sm:rounded-2xl sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      #{rankByKey.get(city.key) ?? index + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground group-hover:underline sm:text-lg">
                      {city.label}
                    </h3>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {listingsLabel(city.listingCount)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground",
                    )}
                  >
                    View
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
