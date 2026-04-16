"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LocationInputSuggest, type LocationSuggestion } from "@/components/location-input-suggest"
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

function cityStateFromSuggestion(s: LocationSuggestion): { city: string; state: string } {
  let city = (s.city ?? "").trim()
  let state = (s.state ?? "").trim()
  if (city && state) return { city, state }
  const parts = s.label.split(",").map((x) => x.trim()).filter(Boolean)
  if (parts.length >= 2) {
    if (!state) state = parts[parts.length - 1] ?? ""
    if (!city) city = parts.slice(0, -1).join(", ")
  }
  if (!city) city = s.label.trim()
  return { city, state }
}

const LISTBOX_ID = "listing-location-suggestions"

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
  const [highlightSaved, setHighlightSaved] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userTypingRef = useRef(true)

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
    const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    try {
      const [labelRes, structRes] = await Promise.all([
        fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`),
        fetch(`/api/geocode/structured?lat=${latitude}&lng=${longitude}`),
      ])
      let displayName = fallback
      let resolvedCity = ""
      let resolvedState = ""
      if (labelRes.ok) {
        const d = (await labelRes.json()) as { displayName?: string }
        if (typeof d.displayName === "string" && d.displayName.trim()) {
          displayName = d.displayName.trim()
        }
      }
      if (structRes.ok) {
        const s = (await structRes.json()) as {
          city_locality?: string | null
          state_province?: string | null
        }
        if (s.city_locality?.trim()) resolvedCity = s.city_locality.trim()
        if (s.state_province?.trim()) resolvedState = s.state_province.trim()
      }
      setCity(resolvedCity)
      setState(resolvedState)
      setDisplayName(displayName)
      return { city: resolvedCity, state: resolvedState, displayName }
    } catch {
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
      userTypingRef.current = false
    }
  }, [initialLat, initialLng, initialCity, initialState, initialDisplay])

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
        userTypingRef.current = false
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
      <Label className="text-base font-medium">Where are you listing from?</Label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground/45"
            aria-hidden
          />
          <LocationInputSuggest
            name="listing-location"
            listboxId={LISTBOX_ID}
            value={searchQuery}
            onChange={(v) => {
              userTypingRef.current = true
              setSearchQuery(v)
              setSearchError(null)
            }}
            onPickSuggestion={(s: LocationSuggestion) => {
              userTypingRef.current = false
              setSearchError(null)
              if (!hasCoords(s.lat, s.lng)) return
              const { city: c, state: st } = cityStateFromSuggestion(s)
              setLat(s.lat)
              setLng(s.lng)
              setCity(c)
              setState(st)
              setDisplayName(s.label)
              setSearchQuery(s.label)
              pushToListing({
                lat: s.lat,
                lng: s.lng,
                city: c,
                state: st,
                displayName: s.label,
              })
            }}
            debounceMs={280}
            placeholder="Start typing a city, ZIP, or beach…"
            inputClassName="h-11 pl-10 pr-10 placeholder:text-muted-foreground/45"
            aria-label="Where you’re listing from"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 gap-2 sm:min-w-[10rem]"
          onClick={handleUseMyLocation}
          disabled={locating}
          title="Use my current area"
          aria-label="Use my current area"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="h-4 w-4 shrink-0" aria-hidden />
          )}
          Use my area
        </Button>
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
                highlightSaved
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-primary/10 text-primary",
              )}
            >
              {highlightSaved ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                <MapPin className="h-4 w-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/45">
                {highlightSaved ? "Saved to your listing" : "You’re listing from"}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground/45 leading-relaxed">
                Type in the box above to change — we never show your exact street.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
