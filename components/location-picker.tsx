"use client"

import React, { useState, useCallback, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LocationInputSuggest, type LocationSuggestion } from "@/components/location-input-suggest"
import { Search, Crosshair, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type LocationPrefillSuggested = {
  city: string
  state: string
  /** Shown in the search field until the user confirms (does not count as a saved listing location). */
  displayLabel: string
}

interface LocationPickerProps {
  onLocationSelect: (location: {
    lat: number
    lng: number
    city: string
    state: string
    displayName: string
  }) => void
  /** Called when the user clears the location (parent should clear stored listing location fields). */
  onLocationClear?: () => void
  /**
   * Profile / last-area hint: pre-fills the search field only. Parent must keep listing location
   * fields empty until the user confirms (button, Enter, suggestion row, or “Use my area”).
   */
  prefillSuggested?: LocationPrefillSuggested | null
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

function initialListingSearchQuery(
  initialDisplay: string | undefined,
  prefillSuggested: LocationPrefillSuggested | null | undefined,
): string {
  const fromListing = initialDisplay?.trim()
  if (fromListing) return fromListing
  const fromPrefill = prefillSuggested?.displayLabel?.trim()
  if (fromPrefill) return fromPrefill
  return ""
}

async function forwardGeocodeSearch(q: string): Promise<{ lat: number; lng: number } | null> {
  const query = q.trim()
  if (!query) return null
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: number; lng?: number; error?: string }
    if (data.error || data.lat == null || data.lng == null) return null
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null
    return { lat: data.lat, lng: data.lng }
  } catch {
    return null
  }
}

export function LocationPicker({
  onLocationSelect,
  onLocationClear,
  prefillSuggested = null,
  initialLat,
  initialLng,
  initialCity,
  initialState,
  initialDisplay,
}: LocationPickerProps) {
  const [lat, setLat] = useState(() =>
    initialLat != null && initialLng != null && hasCoords(initialLat, initialLng) ? initialLat : 0,
  )
  const [lng, setLng] = useState(() =>
    initialLat != null && initialLng != null && hasCoords(initialLat, initialLng) ? initialLng : 0,
  )
  const [city, setCity] = useState(initialCity ?? "")
  const [state, setState] = useState(initialState ?? "")
  const [displayName, setDisplayName] = useState(initialDisplay ?? "")
  const [searchQuery, setSearchQuery] = useState(
    () => initialListingSearchQuery(initialDisplay, prefillSuggested),
  )
  const [highlightSaved, setHighlightSaved] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [confirmingTextLocation, setConfirmingTextLocation] = useState(false)

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** false when SSR/parent prefilled search text so first paint matches server HTML — avoids empty→filled layout shift */
  const userTypingRef = useRef(
    initialListingSearchQuery(initialDisplay, prefillSuggested) === "",
  )

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

  const commitCoordinates = useCallback(
    async (
      nextLat: number,
      nextLng: number,
      cityFallback: string,
      stateFallback: string,
    ) => {
      setLat(nextLat)
      setLng(nextLng)
      const resolved = await reverseGeocode(nextLat, nextLng)
      userTypingRef.current = false
      setSearchQuery(resolved.displayName)
      pushToListing({
        lat: nextLat,
        lng: nextLng,
        city: resolved.city.trim() ? resolved.city : cityFallback,
        state: resolved.state.trim() ? resolved.state : stateFallback,
        displayName: resolved.displayName,
      })
    },
    [pushToListing, reverseGeocode],
  )

  const resolveQueryAndCommit = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim()
      if (!q) {
        setSearchError("Enter an area first, or pick from the suggestions list.")
        return
      }
      setSearchError(null)
      setConfirmingTextLocation(true)
      try {
        const coords = await forwardGeocodeSearch(q)
        if (!coords) {
          setSearchError(
            "We couldn’t place that area. Try choosing a suggestion from the list or adjust what you typed.",
          )
          return
        }
        const fallbackCity = prefillSuggested?.city.trim() ?? ""
        const fallbackState = prefillSuggested?.state.trim() ?? ""
        await commitCoordinates(coords.lat, coords.lng, fallbackCity, fallbackState)
      } finally {
        setConfirmingTextLocation(false)
      }
    },
    [commitCoordinates, prefillSuggested],
  )

  /** Same applying state + reverse-geocode commit as free-text Enter — dropdown picks use this too. */
  const pickSuggestionAndCommit = useCallback(
    async (s: LocationSuggestion) => {
      userTypingRef.current = false
      setSearchError(null)
      if (!hasCoords(s.lat, s.lng)) return
      const { city: c, state: st } = cityStateFromSuggestion(s)
      setConfirmingTextLocation(true)
      try {
        await commitCoordinates(s.lat, s.lng, c, st)
      } finally {
        setConfirmingTextLocation(false)
      }
    },
    [commitCoordinates],
  )

  /** Keep local state in sync when editing/restoring draft, clearing, or switching saved-area hint. */
  useLayoutEffect(() => {
    const hasParentCommittedCoords =
      initialLat != null && initialLng != null && hasCoords(initialLat, initialLng)

    if (hasParentCommittedCoords) {
      setLat(initialLat)
      setLng(initialLng)
      setCity(initialCity ?? "")
      setState(initialState ?? "")
      const display = initialDisplay ?? ""
      setDisplayName(display)
      setSearchQuery(display)
      userTypingRef.current = display.trim().length === 0
      return
    }

    setLat(0)
    setLng(0)
    setCity("")
    setState("")
    setDisplayName("")

    if (prefillSuggested?.displayLabel?.trim()) {
      setSearchQuery(prefillSuggested.displayLabel.trim())
      userTypingRef.current = false
      return
    }

    const display = initialDisplay ?? ""
    setSearchQuery(display)
    userTypingRef.current = display.trim().length === 0
  }, [
    initialLat,
    initialLng,
    initialCity,
    initialState,
    initialDisplay,
    prefillSuggested?.city,
    prefillSuggested?.state,
    prefillSuggested?.displayLabel,
  ])

  const handleClearLocation = useCallback(() => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = null
    setHighlightSaved(false)
    setLat(0)
    setLng(0)
    setCity("")
    setState("")
    setDisplayName("")
    setSearchQuery("")
    setSearchError(null)
    userTypingRef.current = true
    onLocationClear?.()
  }, [onLocationClear])

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

  const parentHasCommittedCoords =
    initialLat != null && initialLng != null && hasCoords(initialLat, initialLng)

  const showSavedLocationCard = hasCoords(lat, lng) && displayName.trim().length > 0

  /** Shown once there is text or a deferred profile hint — avoids an extra control on a totally blank brand-new row. */
  const showConfirmLocationButton =
    !parentHasCommittedCoords &&
    !showSavedLocationCard &&
    (Boolean(prefillSuggested) || searchQuery.trim().length > 0)

  return (
    <div className="space-y-4 [contain:layout]">
      <Label className="text-base font-medium">Where are you listing from?</Label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
        <div className="relative min-h-11 w-full min-w-0 flex-1">
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
              void pickSuggestionAndCommit(s)
            }}
            onEnterWhenPanelClosed={() => {
              void resolveQueryAndCommit(searchQuery)
            }}
            debounceMs={280}
            placeholder="Start typing a city, ZIP, or beach…"
            inputClassName={cn(
              "h-11 pl-10 placeholder:text-muted-foreground/45",
              showSavedLocationCard ? "pr-[4.75rem]" : "pr-10",
            )}
            aria-label="Where you’re listing from"
            disabled={confirmingTextLocation}
          />
          {showSavedLocationCard ? (
            <div className="absolute right-1.5 top-1/2 z-[2] flex -translate-y-1/2 items-center gap-0.5">
              <span className="pointer-events-none flex items-center px-0.5" title="Listing area saved">
                <CheckCircle2
                  className={cn(
                    "h-4 w-4 shrink-0 text-emerald-600 transition-transform duration-300 dark:text-emerald-500",
                    highlightSaved && "scale-110",
                  )}
                  aria-hidden
                />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleClearLocation}
                title="Clear listing area"
                aria-label="Clear listing area"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex min-h-11 w-full shrink-0 gap-2 sm:w-auto",
            !showConfirmLocationButton && "sm:justify-end",
          )}
        >
          {showConfirmLocationButton ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 min-w-0 flex-1 sm:min-w-[9.5rem] sm:flex-initial"
              disabled={confirmingTextLocation || !searchQuery.trim()}
              title="Set this search text as your listing area. You can also press Enter."
              aria-label="Confirm listing location"
              onClick={() => void resolveQueryAndCommit(searchQuery)}
            >
              {confirmingTextLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Applying…
                </>
              ) : (
                "Confirm location"
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 min-w-0 shrink-0 gap-2 sm:min-w-[10rem]",
              showConfirmLocationButton ? "flex-1 sm:flex-initial" : "w-full sm:ml-auto sm:w-auto",
            )}
            onClick={handleUseMyLocation}
            disabled={locating || confirmingTextLocation}
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
    </div>
  )
}
