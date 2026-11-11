"use client"

import { useEffect, useState } from "react"
import { LocateFixed, Loader2, MapPin } from "lucide-react"
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
import { parseBoardsBrowseCoord } from "@/lib/utils/boards-browse-geocode"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Props = {
  state: BoardsFilterState
  listboxId: string
  /** Toolbar popover on `/boards`; sidebar keeps the stacked form fields. */
  layout?: "sidebar" | "toolbar"
  /**
   * Suggestion list placement. Toolbar defaults to a portaled panel; pass `inline`
   * for the mobile drawer so results stay in-flow (no keyboard flip jank).
   */
  panelPlacement?: "portal" | "inline"
  /** Focus the city field when the surface opens (mobile drawer). */
  autoFocus?: boolean
}

/** City/ZIP + radius controls for browse filters. */
export function BoardsBrowseLocationFilter({
  state,
  listboxId,
  layout = "sidebar",
  panelPlacement,
  autoFocus = false,
}: Props) {
  const { toast } = useToast()
  const { goToCityLanding, resolveCityLanding } = useBoardsLocationCityRedirect(state.searchParams)
  const [location, setLocation] = useState(state.location)
  const [pickedPlace, setPickedPlace] = useState<{
    label: string
    lat: number
    lng: number
  } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const isToolbar = layout === "toolbar"
  const urlLat = state.searchParams.get("lat")
  const urlLng = state.searchParams.get("lng")

  useEffect(() => {
    setLocation(state.location)
    const lat = parseBoardsBrowseCoord(urlLat)
    const lng = parseBoardsBrowseCoord(urlLng)
    if (state.location.trim() && lat != null && lng != null) {
      setPickedPlace({ label: state.location, lat, lng })
    } else if (!state.location.trim()) {
      setPickedPlace(null)
    }
  }, [state.location, urlLat, urlLng])

  function locationRadiusGeo():
    | { label: string; lat?: number; lng?: number }
    | undefined {
    const label = location.trim()
    if (!label) return undefined
    const picked =
      pickedPlace && pickedPlace.label.trim() === label ? pickedPlace : null
    const urlCoordsMatch = state.location.trim() === label
    const lat =
      picked?.lat ?? (urlCoordsMatch ? parseBoardsBrowseCoord(urlLat) : undefined)
    const lng =
      picked?.lng ?? (urlCoordsMatch ? parseBoardsBrowseCoord(urlLng) : undefined)
    return { label, lat, lng }
  }

  function commitRadius(value: string | null) {
    state.setRadius(value, locationRadiusGeo())
  }

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

  async function commitTypedLocation() {
    const trimmed = location.trim()
    if (trimmed === state.location.trim()) return
    if (!trimmed) {
      state.setLocationQuery("")
      return
    }
    const match = await resolveCityLanding({ label: trimmed })
    if (match) {
      goToCityLanding(match)
      return
    }
    state.setLocationQuery(trimmed)
  }

  function handleLocationTextChange(next: string) {
    setLocation(next)
    if (pickedPlace && next.trim() !== pickedPlace.label.trim()) {
      setPickedPlace(null)
    }
    if (!next.trim() && state.location.trim()) {
      state.setLocationQuery("")
    }
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
        setLocation(displayName)
        setPickedPlace({ label: displayName, lat, lng })
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

  const suggestPlacement =
    panelPlacement ?? (isToolbar ? "portal" : "inline")

  const suggest = (
    <LocationInputSuggest
      name="boards-location-q"
      placeholder="City or ZIP"
      aria-label="City or ZIP"
      value={location}
      onChange={handleLocationTextChange}
      onPickSuggestion={(place) => {
        setLocation(place.label)
        setPickedPlace({ label: place.label, lat: place.lat, lng: place.lng })
        void applyLocationOrCity({
          label: place.label,
          lat: place.lat,
          lng: place.lng,
          city: place.city,
          state: place.state,
        })
      }}
      onEnterWhenPanelClosed={() => {
        void commitTypedLocation()
      }}
      panelPlacement={suggestPlacement}
      hidePanelFocusRing={isToolbar}
      autoFocus={autoFocus}
      listboxId={listboxId}
      className="min-w-0 flex-1"
      inputClassName={
        isToolbar
          ? "h-10 border-0 bg-transparent px-0 text-[15px] shadow-none ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
          : "h-9 rounded-md text-base md:text-sm"
      }
    />
  )

  const locateButton = (
    <Button
      type="button"
      variant={isToolbar ? "ghost" : "outline"}
      size="icon"
      className={
        isToolbar
          ? "h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-[#1877F2]/10 hover:text-[#1877F2] focus-visible:ring-0 focus-visible:ring-offset-0"
          : "h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
      }
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
  )

  if (isToolbar) {
    return (
      <div className="space-y-3">
        <div className="flex h-10 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 transition-shadow focus-within:border-[#1877F2]/45 focus-within:ring-2 focus-within:ring-[#1877F2]/15">
          <MapPin
            className="h-4 w-4 shrink-0 fill-[#1877F2] stroke-[#1877F2]"
            aria-hidden="true"
          />
          {suggest}
          {locateButton}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Search radius">
          {boardRadiusOptions.map((opt) => {
            const selected = state.radius === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => commitRadius(opt.value === "any" ? null : opt.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors",
                  selected
                    ? "bg-[#1877F2] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
                )}
              >
                {opt.value === "any" ? "Any" : opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-start gap-1.5">
        {suggest}
        {locateButton}
      </div>

      <Select
        name="radius"
        value={state.radius}
        onValueChange={(v) => commitRadius(v === "any" ? null : v)}
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
