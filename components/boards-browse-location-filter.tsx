"use client"

import { useEffect, useRef, useState } from "react"
import { LocateFixed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { useBoardsLocationCityRedirect } from "@/components/features/browse/hooks/use-boards-location-city-redirect"
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
  const { goToCityLanding, resolveCityLanding } = useBoardsLocationCityRedirect(state.searchParams)
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
    const trimmed = location.trim()
    if (trimmed === state.location.trim()) return

    const ac = new AbortController()
    const t = setTimeout(() => {
      void (async () => {
        const match = await resolveCityLanding({ label: trimmed }, ac.signal)
        if (ac.signal.aborted) return
        if (match) {
          goToCityLanding(match)
          return
        }
        state.setLocationQuery(location)
      })()
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [goToCityLanding, location, resolveCityLanding, state.location, state.setLocationQuery])

  async function applyLocationOrCity(opts: {
    label: string
    lat: number
    lng: number
    city?: string
    state?: string
  }) {
    const match = await resolveCityLanding({
      label: opts.label,
      city: opts.city,
      state: opts.state,
    })
    if (match) {
      goToCityLanding(match)
      return
    }
    state.setLocationCoords(opts.label, opts.lat, opts.lng)
  }

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
        await applyLocationOrCity({ label: displayName, lat, lng })
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
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5">
        <LocationInputSuggest
          name="location"
          placeholder="City or ZIP"
          aria-label="City or ZIP"
          value={location}
          onChange={setLocation}
          onPickSuggestion={(place) => {
            skipLocDebounce.current = true
            setLocation(place.label)
            void applyLocationOrCity({
              label: place.label,
              lat: place.lat,
              lng: place.lng,
              city: place.city,
              state: place.state,
            })
          }}
          listboxId={listboxId}
          className="min-w-0 flex-1"
          inputClassName="h-9 rounded-md text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          title="Use my location"
          aria-label="Use my location"
          disabled={locationLoading}
          onClick={handleUseMyLocation}
        >
          {locationLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Select
        name="radius"
        value={state.radius}
        onValueChange={(v) => state.setRadius(v === "any" ? null : v)}
      >
        <SelectTrigger
          aria-label="Search radius (miles from location)"
          className="h-9 rounded-md text-sm"
        >
          <SelectValue placeholder="Any distance" />
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
