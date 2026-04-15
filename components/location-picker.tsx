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

type GeocodeSuggestion = {
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
}

function hasCoords(lat: number, lng: number) {
  return lat !== 0 && lng !== 0 && Number.isFinite(lat) && Number.isFinite(lng)
}

function cityStateFromSuggestion(s: GeocodeSuggestion): { city: string; state: string } {
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

const SUGGEST_DEBOUNCE_MS = 280
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
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [highlightSaved, setHighlightSaved] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userTypingRef = useRef(true)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const pickSuggestion = useCallback(
    (s: GeocodeSuggestion) => {
      userTypingRef.current = false
      setListOpen(false)
      setSuggestions([])
      setSearchError(null)
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
    },
    [pushToListing],
  )

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "ReswellSurfMarketplace/1" } },
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
      userTypingRef.current = false
    }
  }, [initialLat, initialLng, initialCity, initialState, initialDisplay])

  useEffect(() => {
    if (!userTypingRef.current) {
      return
    }

    const q = searchQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      setListOpen(false)
      setSuggestLoading(false)
      return
    }

    const ac = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        setSuggestLoading(true)
        setSearchError(null)
        try {
          const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, {
            signal: ac.signal,
          })
          const data = (await res.json()) as { suggestions?: GeocodeSuggestion[] }
          const list = Array.isArray(data.suggestions) ? data.suggestions : []
          if (!ac.signal.aborted) {
            setSuggestions(list)
            setHighlightIndex(0)
            setListOpen(list.length > 0)
          }
        } catch {
          if (!ac.signal.aborted) {
            setSuggestions([])
            setListOpen(false)
          }
        } finally {
          setSuggestLoading(false)
        }
      })()
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [searchQuery])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setListOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [])

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Your browser doesn’t support location. Try the search box instead.")
      return
    }
    setSearchError(null)
    setListOpen(false)
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

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!listOpen && suggestions.length > 0) {
        setListOpen(true)
        setHighlightIndex(0)
        return
      }
      if (suggestions.length > 0) {
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1))
        setListOpen(true)
      }
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (suggestions.length > 0) {
        setHighlightIndex((i) => Math.max(i - 1, 0))
        setListOpen(true)
      }
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setListOpen(false)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (listOpen && suggestions.length > 0) {
        const s = suggestions[highlightIndex] ?? suggestions[0]
        if (s) pickSuggestion(s)
        return
      }
      if (suggestions.length > 0) {
        pickSuggestion(suggestions[0])
        return
      }
      setSearchError("Keep typing — pick a place from the list, or try a ZIP or city name.")
    }
  }

  const showListingFrom = seeded || hasCoords(lat, lng)
  const activeOptionId =
    listOpen && suggestions[highlightIndex]
      ? `${LISTBOX_ID}-opt-${highlightIndex}`
      : undefined

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Where are you listing from?</Label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div ref={rootRef} className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground/45"
            aria-hidden
          />
          <Input
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listOpen ? LISTBOX_ID : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            value={searchQuery}
            onChange={(e) => {
              userTypingRef.current = true
              setSearchQuery(e.target.value)
              setSearchError(null)
            }}
            onKeyDown={onInputKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setListOpen(true)
            }}
            placeholder="Start typing a city, ZIP, or beach…"
            className="h-11 pl-10 pr-10 placeholder:text-muted-foreground/45"
            aria-label="Where you’re listing from"
            autoComplete="off"
          />
          {suggestLoading ? (
            <Loader2
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground/45"
              aria-hidden
            />
          ) : null}

          {listOpen && suggestions.length > 0 ? (
            <ul
              id={LISTBOX_ID}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[min(18rem,calc(100vh-12rem))] overflow-auto rounded-xl border border-border/80 bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.lat}-${s.lng}-${s.label}`} role="presentation">
                  <button
                    type="button"
                    id={`${LISTBOX_ID}-opt-${i}`}
                    role="option"
                    aria-selected={i === highlightIndex}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm outline-none transition-colors",
                      i === highlightIndex ? "bg-muted" : "hover:bg-muted/70",
                    )}
                    onMouseEnter={() => setHighlightIndex(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                  >
                    <MapPin
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        i === highlightIndex ? "text-primary" : "text-muted-foreground/45",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 leading-snug text-foreground">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
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
