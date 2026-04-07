"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Search, Crosshair, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface LocationPickerProps {
  onLocationSelect: (location: {
    lat: number
    lng: number
    city: string
    state: string
    displayName: string
  }) => void
  initialLat?: number
  initialLng?: number
  initialCity?: string
  initialState?: string
  initialDisplay?: string
}

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialCity,
  initialState,
  initialDisplay,
}: LocationPickerProps) {
  const [lat, setLat] = useState(initialLat ?? 33.7701)
  const [lng, setLng] = useState(initialLng ?? -118.1937)
  const [city, setCity] = useState(initialCity ?? "")
  const [state, setState] = useState(initialState ?? "")
  const [displayName, setDisplayName] = useState(initialDisplay ?? "")
  const [searchQuery, setSearchQuery] = useState(initialDisplay ?? "")
  const [searching, setSearching] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
          { headers: { "Accept-Language": "en" } },
        )
        const data = await res.json()
        const addr = data.address || {}
        const resolvedCity =
          addr.city || addr.town || addr.village || addr.hamlet || initialCity || ""
        const resolvedState = addr.state || initialState || ""
        const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
        setCity(resolvedCity || addr.city || "")
        setState(resolvedState || addr.state || "")
        setDisplayName(display || data.display_name || "Unknown location")
      } catch {
        setCity("")
        setState("")
        setDisplayName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      }
    },
    [initialCity, initialState],
  )

  useEffect(() => {
    if (initialDisplay?.trim()) return
    void reverseGeocode(lat, lng)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label default coordinates once on mount
  }, [])

  function handleApplyLocation() {
    const display = displayName.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    onLocationSelect({
      lat,
      lng,
      city,
      state,
      displayName: display,
    })
    setSearchQuery(display)
    if (!displayName.trim()) setDisplayName(display)
    setAppliedSuccess(true)
    toast.success("Location saved", {
      description: display,
      duration: 3000,
    })
    setTimeout(() => setAppliedSuccess(false), 2500)
  }

  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault?.()
    setSearchError(null)
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } },
      )
      const results = await res.json()
      if (results.length > 0) {
        const result = results[0]
        const newLat = parseFloat(result.lat)
        const newLng = parseFloat(result.lon)
        setLat(newLat)
        setLng(newLng)

        const addr = result.address || {}
        const resolvedCity =
          addr.city || addr.town || addr.village || addr.hamlet || ""
        const resolvedState = addr.state || ""
        const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
        setCity(resolvedCity)
        setState(resolvedState)
        setDisplayName(display || result.display_name || "")
      } else {
        setSearchError("No places found. Try a different search.")
      }
    } catch {
      setSearchError("Search failed. Try again.")
    } finally {
      setSearching(false)
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Location is not supported by your browser.")
      return
    }
    setSearchError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude
        const newLng = position.coords.longitude
        setLat(newLat)
        setLng(newLng)
        reverseGeocode(newLat, newLng)
        setLocating(false)
      },
      () => {
        setSearchError("Could not get your location. Check permissions or search instead.")
        setLocating(false)
      },
    )
  }

  return (
    <div className="space-y-3">
      <Label>Pickup location</Label>
      <p className="text-sm text-muted-foreground">
        Search or use your current location so buyers see the general pickup area.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSearch(e)
              }
            }}
            placeholder="City, address, beach, or ZIP..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={searching}
            onClick={() => handleSearch()}
            className="flex-1 sm:flex-none"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Search</span>
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleUseMyLocation}
            disabled={locating}
            title="Use my current location"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {searchError && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {searchError}
        </div>
      )}

      {displayName && (
        <Card
          className={`border transition-colors ${appliedSuccess ? "border-primary/30 bg-primary/10 ring-2 ring-primary/20" : "border-primary/20 bg-primary/5"}`}
        >
          <CardContent className="flex items-center gap-2 p-3">
            {appliedSuccess ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {appliedSuccess
                  ? "This location is saved to your listing."
                  : "Click Apply location to save this to your listing."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        onClick={handleApplyLocation}
        className={`w-full transition-all sm:w-auto ${appliedSuccess ? "bg-black text-white hover:bg-neutral-800" : ""}`}
      >
        {appliedSuccess ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Location saved
          </>
        ) : (
          <>
            <MapPin className="mr-2 h-4 w-4" />
            Apply location
          </>
        )}
      </Button>
    </div>
  )
}
