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
  siteFilterBorderedInputClassName,
  siteFilterIconButtonClassName,
  siteFilterSelectTriggerClassName,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { useToast } from "@/hooks/use-toast"
import { listingConditionFilterRows } from "@/lib/listing-labels"

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
  { value: "all", label: "Any Condition" },
  ...listingConditionFilterRows(),
]

export const boardSortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
]

type FilterSnapshot = {
  q: string
  location: string
  type: string
  condition: string
  sort: string
  userLat: number | null
  userLng: number | null
}

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialLocation?: string
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
  initialType = "all",
  initialCondition = "all",
  initialSort = "newest",
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
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

  const filtersRef = useRef<FilterSnapshot>({
    q: initialQ,
    location: initialLocation,
    type: initialType,
    condition: initialCondition,
    sort: initialSort,
    userLat: null,
    userLng: null,
  })
  filtersRef.current = { q, location, type, condition, sort, userLat, userLng }

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
  useEffect(() => {
    skipTextDebounceRef.current = true
    skipSelectApplyRef.current = true

    setType(initialType)
    setCondition(initialCondition)
    setSort(initialSort)

    const incomingQ = (initialQ ?? "").trim()
    const incomingLoc = (initialLocation ?? "").trim()
    const expected = expectedAfterReplaceRef.current
    if (expected && expected.q === incomingQ && expected.location === incomingLoc) {
      expectedAfterReplaceRef.current = null
      return
    }

    expectedAfterReplaceRef.current = null
    setQ(initialQ)
    setLocation(initialLocation)
    setUserLat(null)
    setUserLng(null)
  }, [initialQ, initialLocation, initialType, initialCondition, initialSort])

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
      if (live.sort && live.sort !== "newest") params.set("sort", live.sort)
      params.set("page", "1")

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
  }, [type, condition, sort, pushSearchParams])

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
      className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2 items-center md:flex md:flex-wrap md:gap-2 md:items-center"
    >
      <div className="col-span-2 flex max-w-full items-center gap-2 min-w-[200px] md:col-auto md:w-[300px] md:min-w-0 md:max-w-full md:shrink-0">
        <div className="relative flex-1 min-w-[160px]">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 z-[1] h-4 w-4 text-muted-foreground pointer-events-none" />
          <LocationInputSuggest
            name="location"
            placeholder="City or ZIP"
            value={location}
            onChange={(v) => {
              setLocation(v)
              setUserLat(null)
              setUserLng(null)
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
            inputClassName={siteFilterBorderedInputClassName()}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Use my location"
          disabled={locationLoading}
          onClick={handleUseMyLocation}
          className={siteFilterIconButtonClassName()}
        >
          <LocateFixed className={`h-4 w-4 ${userLat != null ? "text-primary" : ""}`} />
        </Button>
      </div>
      <div className="col-span-2 w-full min-w-0 md:col-span-auto md:w-[200px] md:shrink-0">
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
      <div className="w-full min-w-0 md:w-[120px] md:shrink-0">
        <Select name="condition" value={condition} onValueChange={setCondition}>
          <SelectTrigger className={siteFilterSelectTriggerClassName()}>
            <SelectValue placeholder="Any Condition" />
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
      <div className="w-full min-w-0 md:w-[140px] md:shrink-0">
        <Select name="sort" value={sort} onValueChange={setSort}>
          <SelectTrigger className={siteFilterSelectTriggerClassName()}>
            <SelectValue placeholder="Newest" />
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
      <div className="col-span-2 w-full min-w-0 md:col-auto md:w-[360px] md:min-w-[min(360px,100%)] md:max-w-full md:shrink-0">
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
