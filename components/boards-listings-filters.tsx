"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition } from "react"
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

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialLocation?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
}

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
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [location, setLocation] = useState(initialLocation)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

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
    <form
      onSubmit={handleSubmit}
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
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="location"
            placeholder="City or ZIP"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setUserLat(null)
              setUserLng(null)
            }}
            className="pl-9 w-full min-w-0 h-10 min-h-[2.5rem]"
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
      <Button type="submit" disabled={isPending} className="col-span-2 h-10 px-4 md:col-auto md:shrink-0">
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "..." : "Apply"}
      </Button>
    </form>
  )
}
