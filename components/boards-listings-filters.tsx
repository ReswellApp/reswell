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
  { value: "longboard", label: "Longboard" },
  { value: "funboard", label: "Funboard / Mid-length" },
  { value: "fish", label: "Fish" },
  { value: "gun", label: "Gun" },
  { value: "foamie", label: "Foam / Soft Top" },
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

const DEBOUNCE_MS = 320

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

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  useEffect(() => {
    skipTextDebounceRef.current = true
    skipSelectApplyRef.current = true
    setQ(initialQ)
    setLocation(initialLocation)
    setType(initialType)
    setCondition(initialCondition)
    setSort(initialSort)
    setUserLat(null)
    setUserLng(null)
  }, [initialQ, initialLocation, initialType, initialCondition, initialSort])

  const pushSearchParams = useCallback(
    async (override?: Partial<FilterSnapshot>) => {
      const f = { ...filtersRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.location.trim()) params.set("location", f.location.trim())
      if (f.type && f.type !== "all") params.set("type", f.type)
      if (f.condition && f.condition !== "all") params.set("condition", f.condition)
      if (f.sort && f.sort !== "newest") params.set("sort", f.sort)
      params.set("page", "1")

      let lat = f.userLat
      let lng = f.userLng
      if ((lat == null || lng == null) && f.location.trim()) {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(f.location.trim())}`)
          if (res.ok) {
            const data = (await res.json()) as { lat?: number; lng?: number }
            if (data.lat != null && data.lng != null) {
              lat = data.lat
              lng = data.lng
            }
          }
        } catch {
          // proceed without coordinates
        }
      }

      if (lat != null && lng != null) {
        params.set("lat", String(lat))
        params.set("lng", String(lng))
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

  // Debounce free-text and location fields
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
      className="grid grid-cols-2 gap-2 items-center md:flex md:flex-nowrap md:gap-2 md:items-center"
    >
      <div className="col-span-2 flex items-center gap-2 min-w-[200px] md:col-auto md:w-[300px] md:min-w-[300px] md:shrink-0">
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
      <div className="col-span-2 w-full min-w-0 md:col-auto md:shrink-0 md:w-[360px] md:min-w-[min(360px,100%)] md:max-w-full">
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
