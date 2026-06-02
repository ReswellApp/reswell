"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { MapPin, LocateFixed, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BoardsListingsSearchField } from "@/components/boards-listings-search-field"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteFilterSelectTriggerClassName,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { useToast } from "@/hooks/use-toast"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { cn } from "@/lib/utils"

export const boardSortOptions = [
  { value: BOARDS_BROWSE_DEFAULT_SORT, label: "Newest" },
  { value: "price-newest", label: "Highest price" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
]

const BOARD_RADIUS_VALUES = ["25", "50", "100", "200"] as const

export const boardRadiusOptions: { value: string; label: string }[] = [
  { value: "any", label: "Radius" },
  ...BOARD_RADIUS_VALUES.map((mi) => ({ value: mi, label: `${mi} mi` })),
]

function normalizeRadius(r: string | null): string {
  const t = (r ?? "").trim()
  return BOARD_RADIUS_VALUES.includes(t as (typeof BOARD_RADIUS_VALUES)[number]) ? t : "any"
}

const DEBOUNCE_MS = 380

type Props = {
  resultCount?: number
  activeFilterCount: number
  onOpenMobileFilters: () => void
  desktopFiltersOpen?: boolean
  onToggleDesktopFilters?: () => void
  transitionStart?: (cb: () => void) => void
}

/** Slim browse toolbar: keyword search, location/radius, sort, plus the Filter triggers. */
export function BoardsBrowseFilterToolbar({
  resultCount,
  activeFilterCount,
  onOpenMobileFilters,
  desktopFiltersOpen = true,
  onToggleDesktopFilters,
  transitionStart,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [location, setLocation] = useState(searchParams.get("location") ?? "")
  const [locationLoading, setLocationLoading] = useState(false)
  const radius = normalizeRadius(searchParams.get("radius"))
  const sort = searchParams.get("sort") ?? BOARDS_BROWSE_DEFAULT_SORT

  const skipQDebounce = useRef(true)
  const skipLocDebounce = useRef(true)

  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
    skipQDebounce.current = true
  }, [searchParams])
  useEffect(() => {
    setLocation(searchParams.get("location") ?? "")
    skipLocDebounce.current = true
  }, [searchParams])

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      params.delete("page")
      const qs = params.toString()
      const run = () => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
      if (transitionStart) transitionStart(run)
      else run()
    },
    [pathname, router, searchParams, transitionStart],
  )

  useEffect(() => {
    if (skipQDebounce.current) {
      skipQDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      navigate((p) => {
        if (q.trim()) p.set("q", q.trim())
        else p.delete("q")
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, navigate])

  useEffect(() => {
    if (skipLocDebounce.current) {
      skipLocDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      navigate((p) => {
        if (location.trim()) {
          p.set("location", location.trim())
        } else {
          p.delete("location")
          p.delete("lat")
          p.delete("lng")
          p.delete("radius")
        }
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [location, navigate])

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      })
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        let displayName = "My location"
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
          if (res.ok) {
            const { displayName: dn } = await res.json()
            if (dn) displayName = dn as string
          }
        } catch {
          /* keep default label */
        }
        skipLocDebounce.current = true
        setLocation(displayName)
        setLocationLoading(false)
        navigate((p) => {
          p.set("location", displayName)
          p.set("lat", String(lat))
          p.set("lng", String(lng))
        })
      },
      () => {
        toast({
          title: "Location unavailable",
          description: "Allow location access or enter a city or ZIP.",
          variant: "destructive",
        })
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex w-full min-w-0 flex-col gap-3"
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2 rounded-full md:hidden"
          onClick={onOpenMobileFilters}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 ? (
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[11px] tabular-nums">
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>

        <button
          type="button"
          aria-expanded={desktopFiltersOpen}
          aria-label={desktopFiltersOpen ? "Hide filters" : "Show filters"}
          onClick={onToggleDesktopFilters}
          className="hidden shrink-0 items-center gap-2.5 rounded-md px-1 py-1 text-base font-semibold text-foreground transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
        >
          Filter
          <SlidersHorizontal className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden="true" />
          {activeFilterCount > 0 ? (
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[11px] tabular-nums">
              {activeFilterCount}
            </Badge>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <SiteSearchShell
            actionSlot={<SiteSearchFormSubmitButton>Search</SiteSearchFormSubmitButton>}
          >
            <BoardsListingsSearchField
              value={q}
              onChange={setQ}
              name="q"
              className="w-full"
              inputClassName={siteSearchInputClassName()}
            />
          </SiteSearchShell>
        </div>

        <div className="hidden w-[150px] shrink-0 sm:block">
          <Select
            name="sort"
            value={sort}
            onValueChange={(v) => navigate((p) => (v === BOARDS_BROWSE_DEFAULT_SORT ? p.delete("sort") : p.set("sort", v)))}
          >
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {boardSortOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-[22rem]">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <LocationInputSuggest
            name="location"
            placeholder="City or ZIP"
            value={location}
            onChange={(v) => {
              setLocation(v)
            }}
            onPickSuggestion={(place) => {
              skipLocDebounce.current = true
              setLocation(place.label)
              navigate((p) => {
                p.set("location", place.label)
                p.set("lat", String(place.lat))
                p.set("lng", String(place.lng))
              })
            }}
            listboxId="boards-location-suggest"
            endSlot={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-foreground hover:bg-muted"
                title="Use my location"
                aria-label="Use my location"
                disabled={locationLoading}
                onClick={handleUseMyLocation}
              >
                <LocateFixed className="h-4 w-4" />
              </Button>
            }
          />
        </div>

        <Select
          name="radius"
          value={radius}
          onValueChange={(v) => navigate((p) => (v === "any" ? p.delete("radius") : p.set("radius", v)))}
        >
          <SelectTrigger
            aria-label="Search radius (miles from location)"
            className={cn(siteFilterSelectTriggerClassName(), "w-[8.5rem] shrink-0")}
          >
            <SelectValue placeholder="Radius" />
          </SelectTrigger>
          <SelectContent>
            {boardRadiusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-[140px] shrink-0 sm:hidden">
          <Select
            name="sort-mobile"
            value={sort}
            onValueChange={(v) => navigate((p) => (v === BOARDS_BROWSE_DEFAULT_SORT ? p.delete("sort") : p.set("sort", v)))}
          >
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {boardSortOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {resultCount != null ? (
          <span className="ml-auto hidden text-sm text-muted-foreground sm:inline">
            {resultCount.toLocaleString()} {resultCount === 1 ? "board" : "boards"}
          </span>
        ) : null}
      </div>
    </form>
  )
}
