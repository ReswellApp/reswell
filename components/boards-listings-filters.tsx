"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, LocateFixed } from "lucide-react"
import { BoardsListingsSearchField } from "@/components/boards-listings-search-field"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteFilterSelectTriggerClassName,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { useToast } from "@/hooks/use-toast"
import { listingConditionFilterRows } from "@/lib/listing-labels"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { cn } from "@/lib/utils"

export const boardTypes = [
  { value: "all", label: "All Board Types" },
  { value: "shortboard", label: "Shortboard" },
  { value: "groveler", label: "Groveler" },
  { value: "hybrid", label: "Hybrid" },
  { value: "longboard", label: "Longboard" },
  { value: "step-up-gun", label: "Step-Up / Gun" },
  { value: "other", label: "Other" },
]

export const boardConditions = [
  { value: "all", label: "Condition Any" },
  ...listingConditionFilterRows(),
]

export const boardSortOptions = [
  { value: BOARDS_BROWSE_DEFAULT_SORT, label: "All boards" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
]

const BOARD_RADIUS_VALUES = ["25", "50", "100", "200"] as const

/** Surfboard browse map radius (miles). `any` = no distance cap (location text match only unless sort is nearest). Compact labels so the bar does not crowd/overlap. */
export const boardRadiusOptions: { value: string; label: string }[] = [
  { value: "any", label: "Radius" },
  ...BOARD_RADIUS_VALUES.map((mi) => ({
    value: mi,
    label: `${mi} mi`,
  })),
]

function normalizeInitialRadius(r: string | undefined): string {
  if (!r?.trim()) return "any"
  const t = r.trim()
  return BOARD_RADIUS_VALUES.includes(t as (typeof BOARD_RADIUS_VALUES)[number]) ? t : "any"
}

type FilterSnapshot = {
  q: string
  location: string
  radiusMi: string
  type: string
  condition: string
  sort: string
  userLat: number | null
  userLng: number | null
}

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialLocation?: string
  /** Miles from `radius=`; `any` / empty = no distance filter in URL */
  initialRadius?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
  /**
   * When provided, URL updates run inside this transition so the parent can
   * show pending UI (Next.js loading.tsx doesn't fire for search-param navigations).
   */
  transitionStart?: (cb: () => void) => void
}

/** Debounce before syncing keyword/location to the URL so results update as you type without thrashing. */
const DEBOUNCE_MS = 380

export function BoardsListingsFilters({
  initialQ = "",
  initialLocation = "",
  initialRadius = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = BOARDS_BROWSE_DEFAULT_SORT,
  transitionStart: transitionStartProp,
}: BoardsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [, internalStartTransition] = useTransition()
  const startTransition = transitionStartProp ?? internalStartTransition

  const [q, setQ] = useState(initialQ)
  const [location, setLocation] = useState(initialLocation)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [radiusMi, setRadiusMi] = useState(() => normalizeInitialRadius(initialRadius))
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

  const filtersRef = useRef<FilterSnapshot>({
    q: initialQ,
    location: initialLocation,
    radiusMi: normalizeInitialRadius(initialRadius),
    type: initialType,
    condition: initialCondition,
    sort: initialSort,
    userLat: null,
    userLng: null,
  })
  filtersRef.current = { q, location, radiusMi, type, condition, sort, userLat, userLng }

  const skipTextDebounceRef = useRef(true)
  const skipSelectApplyRef = useRef(true)
  /**
   * After `router.replace`, RSC props update with trimmed URL values. We store what we committed
   * so we can skip resetting local text state when it matches (avoids clobbering mid-typing and
   * survives React Strict Mode double-invoking effects).
   */
  const expectedAfterReplaceRef = useRef<{ q: string; location: string } | null>(null)

  // Sync filter UI when server re-renders with new searchParams (back/forward, external links).
  // Skip resetting free-text fields when the payload matches what we just pushed from this form.
  // Only arm the skip refs when a value actually changes — arming them unconditionally would cause
  // the next user interaction to be silently dropped after any server echo of the same values.
  useEffect(() => {
    const typeChanged = initialType !== filtersRef.current.type
    const conditionChanged = initialCondition !== filtersRef.current.condition
    const sortChanged = initialSort !== filtersRef.current.sort
    const nextRadius = normalizeInitialRadius(initialRadius)
    const radiusChanged = nextRadius !== filtersRef.current.radiusMi

    if (typeChanged || conditionChanged || sortChanged || radiusChanged) {
      skipSelectApplyRef.current = true
      setType(initialType)
      setCondition(initialCondition)
      setSort(initialSort)
      setRadiusMi(nextRadius)
    }

    const incomingQ = (initialQ ?? "").trim()
    const incomingLoc = (initialLocation ?? "").trim()
    const expected = expectedAfterReplaceRef.current
    if (expected && expected.q === incomingQ && expected.location === incomingLoc) {
      expectedAfterReplaceRef.current = null
      return
    }

    expectedAfterReplaceRef.current = null
    skipTextDebounceRef.current = true
    setQ(initialQ)
    setLocation(initialLocation)
    setUserLat(null)
    setUserLng(null)
  }, [initialQ, initialLocation, initialRadius, initialType, initialCondition, initialSort])

  const pushSearchParams = useCallback(
    async (override?: Partial<FilterSnapshot>) => {
      const merged = { ...filtersRef.current, ...override }
      const locationForGeocode = merged.location.trim()

      let resolvedLat = merged.userLat
      let resolvedLng = merged.userLng

      if ((resolvedLat == null || resolvedLng == null) && locationForGeocode) {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationForGeocode)}`)
          if (res.ok) {
            const data = (await res.json()) as { lat?: number; lng?: number }
            if (data.lat != null && data.lng != null) {
              resolvedLat = data.lat
              resolvedLng = data.lng
            }
          }
        } catch {
          // proceed without coordinates
        }
      }

      // After any await, use the latest filter state so `q` / location match what the user typed
      // while geocode was in flight (avoids replacing the URL with a stale snapshot).
      const live = { ...filtersRef.current, ...override }
      const liveLocation = live.location.trim()
      if (liveLocation !== locationForGeocode) {
        resolvedLat = live.userLat
        resolvedLng = live.userLng
      }

      const params = new URLSearchParams()
      if (live.q.trim()) params.set("q", live.q.trim())
      if (liveLocation) params.set("location", liveLocation)
      if (live.type && live.type !== "all") params.set("type", live.type)
      if (live.condition && live.condition !== "all") params.set("condition", live.condition)
      if (live.sort && live.sort !== BOARDS_BROWSE_DEFAULT_SORT) params.set("sort", live.sort)
      params.set("page", "1")

      if (
        live.radiusMi &&
        live.radiusMi !== "any" &&
        BOARD_RADIUS_VALUES.includes(live.radiusMi as (typeof BOARD_RADIUS_VALUES)[number])
      ) {
        params.set("radius", live.radiusMi)
      }

      if (
        resolvedLat != null &&
        resolvedLng != null &&
        (liveLocation === locationForGeocode || (live.userLat != null && live.userLng != null))
      ) {
        params.set("lat", String(resolvedLat))
        params.set("lng", String(resolvedLng))
      }

      expectedAfterReplaceRef.current = {
        q: live.q.trim(),
        location: liveLocation,
      }
      startTransition(() => {
        router.replace(
          `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
          { scroll: false },
        )
      })
    },
    [pathname, router, startTransition],
  )

  // Keyword + location: debounced URL sync (live results). Submit still applies immediately.
  useEffect(() => {
    if (skipTextDebounceRef.current) {
      skipTextDebounceRef.current = false
      return
    }
    const t = setTimeout(() => {
      void pushSearchParams()
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, location, pushSearchParams])

  // Selects fire immediately
  useEffect(() => {
    if (skipSelectApplyRef.current) {
      skipSelectApplyRef.current = false
      return
    }
    void pushSearchParams()
  }, [type, condition, sort, radiusMi, pushSearchParams])

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
        const labelFromGeo = async () => {
          try {
            const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
            if (res.ok) {
              const { displayName } = await res.json()
              return (displayName as string) || "My location"
            }
          } catch {
            /* fall through */
          }
          return "My location"
        }
        const displayName = await labelFromGeo()
        setUserLat(lat)
        setUserLng(lng)
        setLocation(displayName)
        setLocationLoading(false)
        await pushSearchParams({ location: displayName, userLat: lat, userLng: lng })
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
      onSubmit={(e) => {
        e.preventDefault()
        void pushSearchParams()
      }}
      className={cn(
        "grid w-full min-w-0 max-w-full grid-cols-2 gap-2 items-center",
        "md:flex md:flex-nowrap md:gap-2 md:overflow-x-auto md:pb-0.5 [scrollbar-width:thin]",
      )}
    >
      <div className="order-2 col-span-2 flex max-w-full min-w-0 items-center gap-2 min-w-[200px] md:order-1 md:col-auto md:shrink-0 md:w-[min(24rem,34vw)] md:min-w-[19rem]">
        <div className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <LocationInputSuggest
            name="location"
            placeholder="City or ZIP"
            value={location}
            onChange={(v) => {
              setLocation(v)
              setUserLat(null)
              setUserLng(null)
              if (!v.trim()) setRadiusMi("any")
            }}
            onPickSuggestion={(place) => {
              setLocation(place.label)
              setUserLat(place.lat)
              setUserLng(place.lng)
              void pushSearchParams({
                location: place.label,
                userLat: place.lat,
                userLng: place.lng,
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
                <LocateFixed className={cn("h-4 w-4", userLat != null && "text-primary")} />
              </Button>
            }
          />
        </div>
        <Select name="radius" value={radiusMi} onValueChange={setRadiusMi}>
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
      </div>
      <div
        className={cn(
          "order-3 col-span-2 grid w-full min-w-0 grid-cols-3 gap-2",
          "md:order-2 md:flex md:w-auto md:shrink-0 md:flex-nowrap md:gap-2",
        )}
      >
        <div className="min-w-0 md:w-[200px] md:shrink-0">
          <Select name="type" value={type} onValueChange={setType}>
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Board type" />
            </SelectTrigger>
            <SelectContent>
              {boardTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 md:w-[120px] md:shrink-0">
          <Select name="condition" value={condition} onValueChange={setCondition}>
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Condition Any" />
            </SelectTrigger>
            <SelectContent>
              {boardConditions.map((cond) => (
                <SelectItem key={cond.value} value={cond.value}>
                  {cond.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 md:w-[140px] md:shrink-0">
          <Select name="sort" value={sort} onValueChange={setSort}>
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Sort order" />
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
      <div className="order-1 col-span-2 w-full min-w-0 md:order-5 md:col-auto md:min-w-[12rem] md:flex-1">
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
    </form>
  )
}
