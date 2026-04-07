"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Search, Crosshair, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

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

function hasCoords(lat: number, lng: number) {
  return lat !== 0 && lng !== 0 && Number.isFinite(lat) && Number.isFinite(lng)
}

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialCity,
  initialState,
  initialDisplay,
}: LocationPickerProps) {
  const seeded =
    (initialLat != null && initialLng != null && hasCoords(initialLat, initialLng)) ||
    Boolean(initialDisplay?.trim())

  const [lat, setLat] = useState(() =>
    initialLat != null && initialLng != null && hasCoords(initialLat, initialLng) ? initialLat : 0,
  )
  const [lng, setLng] = useState(() =>
    initialLat != null && initialLng != null && hasCoords(initialLat, initialLng) ? initialLng : 0,
  )
  const [city, setCity] = useState(initialCity ?? "")
  const [state, setState] = useState(initialState ?? "")
  const [displayName, setDisplayName] = useState(initialDisplay ?? "")
  const [searchQuery, setSearchQuery] = useState(initialDisplay ?? "")
  const [searching, setSearching] = useState(false)
  const [highlightSaved, setHighlightSaved] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashSaved = useCallback(() => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    setHighlightSaved(true)
    highlightTimerRef.current = setTimeout(() => setHighlightSaved(false), 2200)
  }, [])

  const pushToListing = useCallback(
    (next: { lat: number; lng: number; city: string; state: string; displayName: string }) => {
      onLocationSelect(next)
      flashSaved()
    },
    [onLocationSelect, flashSaved],
  )

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
        { headers: { "Accept-Language": "en" } },
      )
      const data = await res.json()
      const addr = data.address || {}
      const resolvedCity = addr.city || addr.town || addr.village || addr.hamlet || ""
      const resolvedState = addr.state || ""
      const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
      const label = display || (typeof data.display_name === "string" ? data.display_name : "") || ""
      setCity(resolvedCity)
      setState(resolvedState)
      setDisplayName(label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      return {
        city: resolvedCity,
        state: resolvedState,
        displayName: label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      }
    } catch {
      const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      setCity("")
      setState("")
      setDisplayName(fallback)
      return { city: "", state: "", displayName: fallback }
    }
  }, [])

  /** Keep local state in sync when editing an existing listing or restoring a draft. */
  useEffect(() => {
    if (initialLat != null && initialLng != null && hasCoords(initialLat, initialLng)) {
      setLat(initialLat)
      setLng(initialLng)
    }
    if (initialCity != null) setCity(initialCity)
    if (initialState != null) setState(initialState)
    if (initialDisplay != null) {
      setDisplayName(initialDisplay)
      setSearchQuery(initialDisplay)
    }
  }, [initialLat, initialLng, initialCity, initialState, initialDisplay])

  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault?.()
    setSearchError(null)
    const q = searchQuery.trim()
    if (!q) {
      setSearchError("Type a place name, ZIP, or neighborhood first.")
      return
    }

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
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
        const resolvedCity = addr.city || addr.town || addr.village || addr.hamlet || ""
        const resolvedState = addr.state || ""
        const display = [resolvedCity, resolvedState].filter(Boolean).join(", ")
        const label =
          display ||
          (typeof result.display_name === "string" ? result.display_name : "") ||
          q

        setCity(resolvedCity)
        setState(resolvedState)
        setDisplayName(label)
        setSearchQuery(label)

        pushToListing({
          lat: newLat,
          lng: newLng,
          city: resolvedCity,
          state: resolvedState,
          displayName: label,
        })
      } else {
        setSearchError("No matches — try a nearby city or ZIP.")
      }
    } catch {
      setSearchError("Something went wrong. Try again in a moment.")
    } finally {
      setSearching(false)
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Your browser doesn’t support location. Try the search box instead.")
      return
    }
    setSearchError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLat = position.coords.latitude
        const newLng = position.coords.longitude
        setLat(newLat)
        setLng(newLng)
        const resolved = await reverseGeocode(newLat, newLng)
        setSearchQuery(resolved.displayName)
        pushToListing({
          lat: newLat,
          lng: newLng,
          city: resolved.city,
          state: resolved.state,
          displayName: resolved.displayName,
        })
        setLocating(false)
      },
      () => {
        setSearchError("We couldn’t read your location. Check permissions or search instead.")
        setLocating(false)
      },
    )
  }

  const showListingFrom = seeded || hasCoords(lat, lng)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-base font-medium">Where are you listing from?</Label>
        <p className="text-sm text-muted-foreground leading-relaxed">
          City, neighborhood, or beach is perfect — buyers only see the general area, not your address.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleSearch(e)
              }
            }}
            placeholder="e.g. Oceanside CA, 90210, Mission Beach…"
            className="h-11 pl-10"
            aria-label="Where you’re listing from"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            disabled={searching}
            onClick={() => void handleSearch()}
            className="h-11 flex-1 gap-2 sm:min-w-[7.5rem] sm:flex-none"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Find
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-3"
            onClick={handleUseMyLocation}
            disabled={locating}
            title="Use my current area"
            aria-label="Use my current area"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {searchError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{searchError}</span>
        </div>
      )}

      {showListingFrom && displayName.trim() && hasCoords(lat, lng) ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 transition-all duration-300",
            highlightSaved
              ? "border-emerald-500/35 bg-emerald-500/[0.08]"
              : "border-border/80 bg-muted/30",
          )}
        >
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                highlightSaved ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary",
              )}
            >
              {highlightSaved ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                <MapPin className="h-4 w-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {highlightSaved ? "Saved to your listing" : "You’re listing from"}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search again anytime to update — we never show your exact street.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tip: press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
          after typing, or tap the target button to use this device’s area.
        </p>
      )}
    </div>
  )
}
