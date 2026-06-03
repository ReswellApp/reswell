"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { siteFilterSelectTriggerClassName } from "@/components/site-search-bar"
import type { BoardsFilterState } from "@/components/boards-browse-filter-state"
import { boardRadiusOptions } from "@/lib/boards-browse-location"
import { useToast } from "@/hooks/use-toast"

const DEBOUNCE_MS = 380

type Props = {
  state: BoardsFilterState
  listboxId: string
}

/** City/ZIP + radius controls for the browse filter sidebar / mobile drawer. */
export function BoardsBrowseLocationFilter({ state, listboxId }: Props) {
  const { toast } = useToast()
  const [location, setLocation] = useState(state.location)
  const [locationLoading, setLocationLoading] = useState(false)
  const skipLocDebounce = useRef(true)

  useEffect(() => {
    setLocation(state.location)
    skipLocDebounce.current = true
  }, [state.location])

  useEffect(() => {
    if (skipLocDebounce.current) {
      skipLocDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      const trimmed = location.trim()
      if (trimmed === state.location.trim()) return
      state.setLocationQuery(location)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [location, state.location, state.setLocationQuery])

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
        state.setLocationCoords(displayName, lat, lng)
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
    <div className="space-y-3">
      <div className="relative w-full">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <LocationInputSuggest
          name="location"
          placeholder="City or ZIP"
          value={location}
          onChange={setLocation}
          onPickSuggestion={(place) => {
            skipLocDebounce.current = true
            setLocation(place.label)
            state.setLocationCoords(place.label, place.lat, place.lng)
          }}
          listboxId={listboxId}
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
        value={state.radius}
        onValueChange={(v) => state.setRadius(v === "any" ? null : v)}
      >
        <SelectTrigger
          aria-label="Search radius (miles from location)"
          className={siteFilterSelectTriggerClassName()}
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
  )
}
