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
import { Search, MapPin, LocateFixed } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { useToast } from "@/hooks/use-toast"

const boardTypes = [
  { value: "all", label: "All Board Types" },
  { value: "shortboard", label: "Shortboard" },
  { value: "longboard", label: "Longboard" },
  { value: "funboard", label: "Funboard / Mid-length" },
  { value: "fish", label: "Fish" },
  { value: "gun", label: "Gun" },
  { value: "foamie", label: "Foam / Soft Top" },
  { value: "other", label: "Other" },
]

const conditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "nearest", label: "Distance (Nearest)" },
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
}

const DEBOUNCE_MS = 320

export function BoardsListingsFilters({
  initialQ = "",
  initialLocation = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = "newest",
}: BoardsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
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
          // proceed without lat/lng
        }
      }

      if (lat != null && lng != null) {
        params.set("lat", String(lat))
        params.set("lng", String(lng))
      }

      startTransition(() => {
        router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
      })
    },
    [pathname, router],
  )

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
        description: "Your browser doesn’t support geolocation.",
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
      className="grid grid-cols-2 gap-2 items-end md:flex md:flex-nowrap md:gap-2 md:items-end"
    >
      <div className="col-span-2 w-full min-w-0 md:col-auto md:shrink-0 md:w-[400px] md:min-w-[400px]">
        <SearchInputWithSuggest
          value={q}
          onChange={setQ}
          placeholder="Search surfboards..."
          section="surfboards"
          leftIcon={<Search className="h-4 w-4" />}
          name="q"
          listboxId="boards-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="col-span-2 flex items-center gap-2 min-w-[200px] md:col-auto md:w-[360px] md:min-w-[360px] md:shrink-0">
        <div className="relative flex-1 min-w-[180px] overflow-hidden">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 z-[1] h-4 w-4 text-muted-foreground pointer-events-none" />
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
            inputClassName="pl-9 w-full min-w-0 h-10 min-h-[2.5rem]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Use my location"
          disabled={locationLoading}
          onClick={handleUseMyLocation}
          className="shrink-0 h-10 w-10"
        >
          <LocateFixed className={`h-4 w-4 ${userLat != null ? "text-primary" : ""}`} />
        </Button>
      </div>
      <div className="w-full min-w-0 md:w-[140px] md:shrink-0">
        <Select name="type" value={type} onValueChange={setType}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="All Board Types" />
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
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any Condition" />
          </SelectTrigger>
          <SelectContent>
            {conditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>
                {cond.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="sort" value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Newest First" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
