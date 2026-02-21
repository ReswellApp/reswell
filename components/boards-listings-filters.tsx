"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, MapPin, SlidersHorizontal, LocateFixed } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { useToast } from "@/hooks/use-toast"

const BOARDS_BRAND_OPTIONS = [
  "JS Surfboards",
  "Channel Islands Surfboards",
  "Lost Surfboards",
  "Ryan Lovelace",
  "Album Surfboards",
]

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

const radiusOptions = [
  { value: "", label: "Any distance" },
  { value: "10", label: "Within 10 mi" },
  { value: "25", label: "Within 25 mi" },
  { value: "50", label: "Within 50 mi" },
  { value: "100", label: "Within 100 mi" },
]

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialLocation?: string
  initialType?: string
  initialCondition?: string
  initialBrand?: string
  initialMinPrice?: string
  initialMaxPrice?: string
  initialRadius?: string
  initialSort?: string
}

export function BoardsListingsFilters({
  initialQ = "",
  initialLocation = "",
  initialType = "all",
  initialCondition = "all",
  initialBrand = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialRadius = "",
  initialSort = "newest",
}: BoardsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [location, setLocation] = useState(initialLocation)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [brand, setBrand] = useState(initialBrand)
  const [minPrice, setMinPrice] = useState(initialMinPrice)
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice)
  const [radius, setRadius] = useState(initialRadius)
  const [sort, setSort] = useState(initialSort)
  const [apiBrands, setApiBrands] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/brands?section=surfboards")
      .then((r) => r.json())
      .then((list: string[]) => setApiBrands(list || []))
      .catch(() => {})
  }, [])

  const curatedSet = new Set(BOARDS_BRAND_OPTIONS.map((b) => b.toLowerCase()))
  const otherBrands = (apiBrands || []).filter((b) => !curatedSet.has(b.toLowerCase())).sort((a, b) => a.localeCompare(b))
  const brandOptions = [
    ...BOARDS_BRAND_OPTIONS,
    ...otherBrands,
    ...(initialBrand && !BOARDS_BRAND_OPTIONS.includes(initialBrand) && !otherBrands.includes(initialBrand) ? [initialBrand] : []),
  ]

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported", description: "Your browser doesn’t support geolocation.", variant: "destructive" })
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setUserLat(lat)
        setUserLng(lng)
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
          if (res.ok) {
            const { displayName } = await res.json()
            if (displayName) setLocation(displayName)
            else setLocation("My location")
          } else {
            setLocation("My location")
          }
        } catch {
          setLocation("My location")
        }
        setLocationLoading(false)
      },
      () => {
        toast({ title: "Location unavailable", description: "Allow location access or enter a city or ZIP.", variant: "destructive" })
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (location.trim()) params.set("location", location.trim())
    if (type && type !== "all") params.set("type", type)
    if (condition && condition !== "all") params.set("condition", condition)
    if (brand.trim()) params.set("brand", brand.trim())
    if (minPrice.trim()) params.set("minPrice", minPrice.trim())
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim())
    if (radius.trim()) params.set("radius", radius.trim())
    if (sort && sort !== "newest") params.set("sort", sort)
    params.set("page", "1")

    if (userLat != null && userLng != null) {
      params.set("lat", String(userLat))
      params.set("lng", String(userLng))
    } else if (location.trim()) {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(location.trim())}`)
        if (res.ok) {
          const { lat, lng } = await res.json()
          if (lat != null && lng != null) {
            params.set("lat", String(lat))
            params.set("lng", String(lng))
          }
        }
      } catch {
        // proceed without lat/lng
      }
    }

    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <SearchInputWithSuggest
          value={q}
          onChange={setQ}
          placeholder="Search surfboards..."
          section="surfboards"
          leftIcon={<Search className="h-4 w-4" />}
          name="q"
          listboxId="boards-search-suggestions"
        />
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="location"
            placeholder="City or ZIP..."
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setUserLat(null)
              setUserLng(null)
            }}
            className="pl-10 w-[150px]"
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

      <Select name="type" value={type} onValueChange={setType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Board Type" />
        </SelectTrigger>
        <SelectContent>
          {boardTypes.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">Brand</label>
        <Select
          value={brand || "all"}
          onValueChange={(v) => setBrand(v === "all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any brand</SelectItem>
            {brandOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select name="condition" value={condition} onValueChange={setCondition}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Condition" />
        </SelectTrigger>
        <SelectContent>
          {conditions.map((cond) => (
            <SelectItem key={cond.value} value={cond.value}>
              {cond.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Min $</label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-[80px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Max $</label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-[80px]"
          />
        </div>
      </div>

      <div className="w-[130px]">
        <label className="text-xs text-muted-foreground mb-1 block">Radius</label>
        <Select value={radius || "any"} onValueChange={(v) => setRadius(v === "any" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Any distance" />
          </SelectTrigger>
          <SelectContent>
            {radiusOptions.map((opt) => (
              <SelectItem key={opt.value || "any"} value={opt.value || "any"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select name="sort" value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" disabled={isPending}>
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  )
}
