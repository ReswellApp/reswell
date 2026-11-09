"use client"

import { useEffect, useId, useState } from "react"
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
import { boardRadiusOptions } from "@/lib/boards-browse-location"
import { useToast } from "@/hooks/use-toast"

export type BrowseLocationRadiusValue = {
  location: string
  lat: number | null
  lng: number | null
  radiusMi: string
}

type Props = {
  value: BrowseLocationRadiusValue
  onChange: (next: BrowseLocationRadiusValue) => void
  disabled?: boolean
  locationInputName?: string
}

/** City/ZIP + radius controls shared by browse filters and profile pickup preference. */
export function BrowseLocationRadiusFields({
  value,
  onChange,
  disabled = false,
  locationInputName = "browse-location-q",
}: Props) {
  const { toast } = useToast()
  const listboxId = useId()
  const [locationDraft, setLocationDraft] = useState(value.location)
  const [locationLoading, setLocationLoading] = useState(false)

  useEffect(() => {
    setLocationDraft(value.location)
  }, [value.location])

  function applyPlace(opts: {
    label: string
    lat: number
    lng: number
  }) {
    onChange({
      ...value,
      location: opts.label,
      lat: opts.lat,
      lng: opts.lng,
    })
    setLocationDraft(opts.label)
  }

  function commitTypedLocation() {
    const trimmed = locationDraft.trim()
    if (trimmed === value.location.trim()) return
    if (!trimmed) {
      onChange({ ...value, location: "", lat: null, lng: null })
      return
    }
    onChange({ ...value, location: trimmed, lat: null, lng: null })
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
        applyPlace({ label: displayName, lat, lng })
        setLocationLoading(false)
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
      <div className="flex items-start gap-1.5">
        <LocationInputSuggest
          name={locationInputName}
          placeholder="City or ZIP"
          aria-label="City or ZIP"
          value={locationDraft}
          disabled={disabled}
          onChange={(next) => {
            setLocationDraft(next)
            if (!next.trim() && value.location.trim()) {
              onChange({ ...value, location: "", lat: null, lng: null })
            }
          }}
          onPickSuggestion={(place) => {
            applyPlace({
              label: place.label,
              lat: place.lat,
              lng: place.lng,
            })
          }}
          onEnterWhenPanelClosed={() => {
            void commitTypedLocation()
          }}
          panelPlacement="inline"
          listboxId={listboxId}
          className="min-w-0 flex-1"
          inputClassName="h-9 rounded-md text-base md:text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          title="Use my location"
          aria-label="Use my location"
          disabled={disabled || locationLoading}
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
        value={value.radiusMi}
        disabled={disabled}
        onValueChange={(v) => onChange({ ...value, radiusMi: v === "any" ? "50" : v })}
      >
        <SelectTrigger
          aria-label="Search radius (miles from location)"
          className="h-9 rounded-md text-sm"
        >
          <SelectValue placeholder="Any distance" />
        </SelectTrigger>
        <SelectContent>
          {boardRadiusOptions
            .filter((opt) => opt.value !== "any")
            .map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  )
}
