"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { SITE_FILTER_BAR_HEIGHT } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import { loadGoogleMapsWithPlaces } from "@/lib/maps/load-google-maps"
import {
  choosePlacesAutocompleteBackend,
  legacyFetchPlaceDetails,
  legacyFetchRegionPredictions,
} from "@/lib/maps/places-legacy-autocomplete"
import {
  AUTOCOMPLETE_US_REGION_PRIMARY_TYPES,
  createAutocompleteSessionToken,
  fetchAutocompletePlacePredictions,
  newPlaceAddressComponentsToGeocoder,
  readPlaceLocationLatLng,
  suggestionToRowTexts,
  type AutocompleteSuggestionItem,
  type PlacePredictionHandle,
} from "@/lib/maps/places-autocomplete-new"
import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"
import { Building2, Loader2, MapPin } from "lucide-react"

export type LocationSuggestion = {
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
}

type SuggestMode = "location" | "address"

type GoogleLocationRow = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
  prediction?: PlacePredictionHandle
}

interface LocationInputSuggestProps {
  value: string
  onChange: (value: string) => void
  /** When the user picks a row, coords are known so Apply can skip a second geocode. */
  onPickSuggestion: (place: LocationSuggestion) => void
  /** Use `/api/geocode/suggest?address=1` for US street-level matches (checkout OSM fallback). */
  suggestMode?: SuggestMode
  /**
   * When false, picking a row does not write `label` into the input (caller fills from structured geocode).
   * @default true
   */
  pickSetsInputValue?: boolean
  name?: string
  id?: string
  placeholder?: string
  className?: string
  inputClassName?: string
  listboxId?: string
  minLength?: number
  debounceMs?: number
  disabled?: boolean
  /** Passed to the underlying input (accessibility). */
  "aria-label"?: string
  /**
   * Renders inside the same pill as the input (e.g. geolocation). Use borderless controls;
   * the shell supplies height, border, and focus ring.
   */
  endSlot?: React.ReactNode
  /**
   * When the suggestion dropdown is closed and the user presses Enter, optional handler
   * (e.g. geocode the current input as a free-text confirm).
   */
  onEnterWhenPanelClosed?: () => void
}

const HAS_GOOGLE_KEY = Boolean(
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
)

/** If autocomplete fetch hangs, stop showing an in-field spinner. */
const GOOGLE_PREDICTION_HANG_MS = 12_000

/** If `getDetails` never calls back after picking a row, clear resolving state. */
const GOOGLE_PLACE_DETAILS_HANG_MS = 15_000

const LOCATION_SUGGEST_CACHE_MAX = 64

const locationSuggestCache = new Map<string, LocationSuggestion[]>()

function cacheKey(q: string, mode: SuggestMode) {
  return `${q.trim().toLowerCase()}|${mode}`
}

function readSuggestCache(q: string, mode: SuggestMode): LocationSuggestion[] | undefined {
  const k = cacheKey(q, mode)
  if (k.length < 2) return undefined
  const v = locationSuggestCache.get(k)
  if (!v) return undefined
  locationSuggestCache.delete(k)
  locationSuggestCache.set(k, v)
  return v
}

function writeSuggestCache(q: string, mode: SuggestMode, suggestions: LocationSuggestion[]) {
  const k = cacheKey(q, mode)
  if (k.length < 2) return
  if (locationSuggestCache.has(k)) locationSuggestCache.delete(k)
  locationSuggestCache.set(k, suggestions)
  while (locationSuggestCache.size > LOCATION_SUGGEST_CACHE_MAX) {
    const oldest = locationSuggestCache.keys().next().value
    if (oldest === undefined) break
    locationSuggestCache.delete(oldest)
  }
}

async function fetchSuggestions(
  q: string,
  signal: AbortSignal | undefined,
  mode: SuggestMode,
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ q })
  if (mode === "address") params.set("address", "1")
  const res = await fetch(`/api/geocode/suggest?${params.toString()}`, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { suggestions?: LocationSuggestion[] }
  return Array.isArray(data.suggestions) ? data.suggestions : []
}

async function forwardGeocodeServer(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: number; lng?: number; error?: string }
    if (data.error || data.lat == null || data.lng == null) return null
    return { lat: data.lat, lng: data.lng }
  } catch {
    return null
  }
}

function mapAutocompleteSuggestions(
  suggestions: readonly AutocompleteSuggestionItem[],
): GoogleLocationRow[] {
  const rows: GoogleLocationRow[] = []
  for (const s of suggestions) {
    const row = suggestionToRowTexts(s)
    if (row) rows.push(row)
  }
  return rows
}

/** Split API label into a street line and locality for denser list rows. */
function splitSuggestionLabel(label: string): { primary: string; secondary: string | null } {
  const parts = label
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length <= 1) return { primary: label.trim(), secondary: null }
  return { primary: parts[0]!, secondary: parts.slice(1).join(", ") }
}

/** Bold the substring of `text` that best matches what the user typed. */
function HighlightMatch({
  text,
  query,
  muted,
}: {
  text: string
  query: string
  /** Smaller, subdued styling for subtitle lines. */
  muted?: boolean
}) {
  const q = query.trim()
  const matchClass = muted
    ? "font-medium text-neutral-800"
    : "font-semibold text-foreground"
  if (!q) {
    return muted ? <span className="text-[13px] text-neutral-500">{text}</span> : <>{text}</>
  }

  const lower = text.toLowerCase()
  const fullIdx = lower.indexOf(q.toLowerCase())
  if (fullIdx >= 0) {
    return (
      <span className={cn(muted && "text-[13px] text-neutral-500")}>
        {text.slice(0, fullIdx)}
        <span className={matchClass}>{text.slice(fullIdx, fullIdx + q.length)}</span>
        {text.slice(fullIdx + q.length)}
      </span>
    )
  }

  const word = q.split(/\s+/).find((w) => w.length >= 2) ?? ""
  if (!word) return muted ? <span className="text-[13px] text-neutral-500">{text}</span> : <>{text}</>
  const wi = lower.indexOf(word.toLowerCase())
  if (wi < 0) return muted ? <span className="text-[13px] text-neutral-500">{text}</span> : <>{text}</>

  return (
    <span className={cn(muted && "text-[13px] text-neutral-500")}>
      {text.slice(0, wi)}
      <span className={matchClass}>{text.slice(wi, wi + word.length)}</span>
      {text.slice(wi + word.length)}
    </span>
  )
}

export function LocationInputSuggest({
  value,
  onChange,
  onPickSuggestion,
  suggestMode = "location",
  pickSetsInputValue = true,
  name = "location",
  id,
  placeholder = "City or ZIP",
  className = "",
  inputClassName = "",
  listboxId = "location-suggest-listbox",
  minLength = 2,
  debounceMs = 180,
  disabled = false,
  "aria-label": ariaLabel,
  endSlot,
  onEnterWhenPanelClosed,
}: LocationInputSuggestProps) {
  const [open, setOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [googleRows, setGoogleRows] = useState<GoogleLocationRow[]>([])
  const [fetchEmpty, setFetchEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [googleLocationReady, setGoogleLocationReady] = useState(false)
  const [googleLocationFailed, setGoogleLocationFailed] = useState(() => !HAS_GOOGLE_KEY)
  const [resolvingPick, setResolvingPick] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const suppressOpenUntilTypingRef = useRef(false)
  const blurCloseTimerRef = useRef<number | null>(null)
  const pickLockRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const googlePlacesBackendRef = useRef<"new" | "legacy" | null>(null)
  const googleAutocompleteSvcRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const googlePredictHangTimerRef = useRef<number | null>(null)
  const placeDetailsHangTimerRef = useRef<number | null>(null)

  const qTrim = value.trim()
  const isAddress = suggestMode === "address"
  const preferGoogleLocation = suggestMode === "location" && HAS_GOOGLE_KEY
  const useGoogleLocationPath = preferGoogleLocation && googleLocationReady && !googleLocationFailed
  const mapsBootPending = preferGoogleLocation && !googleLocationReady && !googleLocationFailed

  const listHasResults = useGoogleLocationPath ? googleRows.length > 0 : suggestions.length > 0

  /**
   * Do not gate on input focus. On mobile, tapping a suggestion blurs the field before click;
   * requiring focus unmounted the portaled list and the pick never applied.
   * Close via pick, Escape, or the document pointerdown-outside handler instead.
   */
  const panelOpen =
    open &&
    qTrim.length >= minLength &&
    !suppressOpenUntilTypingRef.current &&
    !mapsBootPending &&
    (useGoogleLocationPath
      ? googleRows.length > 0 || fetchEmpty || loading
      : suggestions.length > 0 || fetchEmpty || (!isAddress && loading))

  const invalidatePending = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const isInputFocused = () =>
    Boolean(inputRef.current && document.activeElement === inputRef.current)

  /** Keep an already-open panel open through mobile blur→tap; only open fresh when focused. */
  const setOpenAfterFetch = (allowOpen: boolean) => {
    setOpen((prev) => {
      if (!allowOpen) return false
      return isInputFocused() || prev
    })
  }

  useEffect(() => {
    if (!preferGoogleLocation) {
      setGoogleLocationReady(false)
      setGoogleLocationFailed(true)
      googlePlacesBackendRef.current = null
      googleAutocompleteSvcRef.current = null
      return
    }
    let cancelled = false
    setGoogleLocationFailed(false)
    void loadGoogleMapsWithPlaces()
      .then((g) => {
        if (cancelled) return
        googlePlacesBackendRef.current = choosePlacesAutocompleteBackend(g)
        if (googlePlacesBackendRef.current === "legacy") {
          googleAutocompleteSvcRef.current = new g.maps.places.AutocompleteService()
        }
        setGoogleLocationReady(true)
      })
      .catch(() => {
        if (!cancelled) setGoogleLocationFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [preferGoogleLocation])

  useEffect(() => {
    return () => {
      if (googlePredictHangTimerRef.current) {
        clearTimeout(googlePredictHangTimerRef.current)
        googlePredictHangTimerRef.current = null
      }
      if (placeDetailsHangTimerRef.current) {
        clearTimeout(placeDetailsHangTimerRef.current)
        placeDetailsHangTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    const q = value.trim()
    if (q.length < minLength) {
      invalidatePending()
      setSuggestions([])
      setGoogleRows([])
      setOpen(false)
      setLoading(false)
      setFetchEmpty(false)
      setActiveIndex(-1)
      return
    }

    if (mapsBootPending) {
      invalidatePending()
      setSuggestions([])
      setGoogleRows([])
      setFetchEmpty(false)
      setActiveIndex(-1)
      return
    }

    setFetchEmpty(false)

    const runId = ++generationRef.current
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null

    // —— Google Maps JS API (city / ZIP / region) — same loader as checkout address field
    if (useGoogleLocationPath) {
      setLoading(true)
      setGoogleRows([])
      setActiveIndex(-1)
      setSuggestions([])

      debounceRef.current = setTimeout(() => {
        if (runId !== generationRef.current) return
        const g = window.google
        if (!g?.maps?.places) {
          setLoading(false)
          return
        }

        if (googlePredictHangTimerRef.current) {
          clearTimeout(googlePredictHangTimerRef.current)
          googlePredictHangTimerRef.current = null
        }
        googlePredictHangTimerRef.current = window.setTimeout(() => {
          googlePredictHangTimerRef.current = null
          if (runId !== generationRef.current) return
          setLoading(false)
        }, GOOGLE_PREDICTION_HANG_MS)

        void (async () => {
          try {
            const backend = googlePlacesBackendRef.current

            if (backend === "legacy") {
              const svc = googleAutocompleteSvcRef.current
              if (!svc) {
                throw new Error("Legacy AutocompleteService not initialized")
              }
              const list = await legacyFetchRegionPredictions(g, svc, q)

              if (googlePredictHangTimerRef.current) {
                clearTimeout(googlePredictHangTimerRef.current)
                googlePredictHangTimerRef.current = null
              }
              if (runId !== generationRef.current) return

              const mappedRows: GoogleLocationRow[] = list.map((p) => ({
                placeId: p.placeId,
                description: [p.mainText, p.secondaryText].filter(Boolean).join(", "),
                mainText: p.mainText,
                secondaryText: p.secondaryText,
              }))

              if (mappedRows.length > 0) {
                setGoogleRows(mappedRows)
                setFetchEmpty(false)
                setActiveIndex(0)
                const allowOpen = !suppressOpenUntilTypingRef.current
                setOpenAfterFetch(allowOpen)
              } else {
                setGoogleRows([])
                setFetchEmpty(true)
                setActiveIndex(-1)
                const allowOpen = !suppressOpenUntilTypingRef.current
                setOpenAfterFetch(allowOpen)
              }
              return
            }

            if (!sessionTokenRef.current) {
              sessionTokenRef.current = createAutocompleteSessionToken(g) ?? null
            }
            const sessionToken = sessionTokenRef.current

            const baseReq: Record<string, unknown> = {
              input: q,
              includedRegionCodes: ["US"],
              region: "us",
              language: "en",
              sessionToken: sessionToken ?? undefined,
            }
            let suggestions = await fetchAutocompletePlacePredictions(g, {
              ...baseReq,
              includedPrimaryTypes: [...AUTOCOMPLETE_US_REGION_PRIMARY_TYPES],
            })
            let rows = mapAutocompleteSuggestions(suggestions)
            if (rows.length === 0) {
              suggestions = await fetchAutocompletePlacePredictions(g, {
                ...baseReq,
              })
              rows = mapAutocompleteSuggestions(suggestions)
            }

            if (googlePredictHangTimerRef.current) {
              clearTimeout(googlePredictHangTimerRef.current)
              googlePredictHangTimerRef.current = null
            }
            if (runId !== generationRef.current) return

            if (rows.length > 0) {
              setGoogleRows(rows)
              setFetchEmpty(false)
              setActiveIndex(0)
              const allowOpen = !suppressOpenUntilTypingRef.current
              setOpenAfterFetch(allowOpen)
            } else {
              setGoogleRows([])
              setFetchEmpty(true)
              setActiveIndex(-1)
              const allowOpen = !suppressOpenUntilTypingRef.current
              setOpenAfterFetch(allowOpen)
            }
          } catch {
            if (googlePredictHangTimerRef.current) {
              clearTimeout(googlePredictHangTimerRef.current)
              googlePredictHangTimerRef.current = null
            }
            if (runId !== generationRef.current) return
            try {
              const g = window.google
              if (!g?.maps?.places) throw new Error("no places")
              if (!googleAutocompleteSvcRef.current) {
                googleAutocompleteSvcRef.current = new g.maps.places.AutocompleteService()
              }
              googlePlacesBackendRef.current = "legacy"
              const list = await legacyFetchRegionPredictions(g, googleAutocompleteSvcRef.current, q)
              if (runId !== generationRef.current) return
              const mappedRows: GoogleLocationRow[] = list.map((p) => ({
                placeId: p.placeId,
                description: [p.mainText, p.secondaryText].filter(Boolean).join(", "),
                mainText: p.mainText,
                secondaryText: p.secondaryText,
              }))
              if (mappedRows.length > 0) {
                setGoogleRows(mappedRows)
                setFetchEmpty(false)
                setActiveIndex(0)
                const allowOpen = !suppressOpenUntilTypingRef.current
                setOpenAfterFetch(allowOpen)
              } else {
                setGoogleRows([])
                setFetchEmpty(true)
                setActiveIndex(-1)
                const allowOpen = !suppressOpenUntilTypingRef.current
                setOpenAfterFetch(allowOpen)
              }
            } catch {
              setGoogleRows([])
              setFetchEmpty(true)
              setActiveIndex(-1)
              const allowOpen = !suppressOpenUntilTypingRef.current
              setOpenAfterFetch(allowOpen)
            }
          } finally {
            if (runId === generationRef.current) setLoading(false)
          }
        })()
      }, debounceMs)

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        if (googlePredictHangTimerRef.current) {
          clearTimeout(googlePredictHangTimerRef.current)
          googlePredictHangTimerRef.current = null
        }
      }
    }

    // —— HTTP: OSM-backed /api/geocode/suggest (address mode, or location when Google unavailable)
    const cachedImmediate = readSuggestCache(q, suggestMode)
    if (cachedImmediate !== undefined) {
      if (runId !== generationRef.current) return
      setSuggestions(cachedImmediate)
      setGoogleRows([])
      setFetchEmpty(cachedImmediate.length === 0)
      setActiveIndex(cachedImmediate.length > 0 ? 0 : -1)
      setLoading(false)
      const allowOpen = !suppressOpenUntilTypingRef.current
      setOpenAfterFetch(allowOpen)
      return
    }

    setLoading(true)
    setSuggestions([])
    setGoogleRows([])
    setActiveIndex(-1)

    debounceRef.current = setTimeout(() => {
      if (runId !== generationRef.current) return

      const cached = readSuggestCache(q, suggestMode)
      if (cached !== undefined) {
        setSuggestions(cached)
        setFetchEmpty(cached.length === 0)
        setActiveIndex(cached.length > 0 ? 0 : -1)
        const allowOpen = !suppressOpenUntilTypingRef.current
        setOpenAfterFetch(allowOpen)
        setLoading(false)
        return
      }

      const ac = new AbortController()
      abortRef.current = ac

      void (async () => {
        if (runId !== generationRef.current) return
        try {
          const list = await fetchSuggestions(q, ac.signal, suggestMode)
          if (runId !== generationRef.current) return
          writeSuggestCache(q, suggestMode, list)
          setSuggestions(list)
          setFetchEmpty(list.length === 0)
          setActiveIndex(list.length > 0 ? 0 : -1)
          const allowOpen = !suppressOpenUntilTypingRef.current
          setOpenAfterFetch(allowOpen)
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return
        } finally {
          if (runId === generationRef.current) setLoading(false)
        }
      })()
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      abortRef.current?.abort()
    }
  }, [
    value,
    minLength,
    debounceMs,
    disabled,
    invalidatePending,
    suggestMode,
    useGoogleLocationPath,
    mapsBootPending,
  ])

  const hasResults = listHasResults
  const showListbox = panelOpen && hasResults && !loading

  useEffect(() => {
    if (!panelOpen) {
      setDropdownRect(null)
      return
    }
    const anchorEl = () =>
      endSlot ? (shellRef.current ?? inputRef.current ?? containerRef.current) : (inputRef.current ?? containerRef.current)
    const update = () => {
      const el = anchorEl()
      if (!el) return
      const rect = el.getBoundingClientRect()
      const gap = 6
      setDropdownRect({ top: rect.bottom + gap, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, { capture: true, passive: true })
    window.addEventListener("resize", update, { passive: true })
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (vv) {
      vv.addEventListener("scroll", update, { passive: true })
      vv.addEventListener("resize", update, { passive: true })
    }
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => update()) : null
    const watch = anchorEl()
    if (ro && watch) ro.observe(watch)
    const t0 = window.setTimeout(update, 0)
    const t1 = window.setTimeout(update, 120)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      if (vv) {
        vv.removeEventListener("scroll", update)
        vv.removeEventListener("resize", update)
      }
      ro?.disconnect()
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [panelOpen, endSlot])

  useEffect(() => {
    if (!showListbox || activeIndex < 0) return
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, showListbox, listboxId])

  useEffect(() => {
    function handlePointerOutside(e: PointerEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      invalidatePending()
      setOpen(false)
      setActiveIndex(-1)
    }
    // pointerdown covers touch + mouse; mousedown-only misses iOS taps that blur the field first
    document.addEventListener("pointerdown", handlePointerOutside)
    return () => document.removeEventListener("pointerdown", handlePointerOutside)
  }, [invalidatePending])

  useEffect(() => {
    return () => {
      if (blurCloseTimerRef.current) {
        window.clearTimeout(blurCloseTimerRef.current)
        blurCloseTimerRef.current = null
      }
    }
  }, [])

  const pickHttp = useCallback(
    (item: LocationSuggestion) => {
      if (pickLockRef.current) return
      pickLockRef.current = true
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      setFetchEmpty(false)
      if (pickSetsInputValue) {
        onChange(item.label)
      }
      onPickSuggestion(item)
      setOpen(false)
      setSuggestions([])
      setGoogleRows([])
      setActiveIndex(-1)
      pickLockRef.current = false
    },
    [invalidatePending, onChange, onPickSuggestion, pickSetsInputValue],
  )

  const pickGoogleRow = useCallback(
    (row: GoogleLocationRow) => {
      if (pickLockRef.current) return
      pickLockRef.current = true
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      setFetchEmpty(false)
      setOpen(false)
      setGoogleRows([])
      setSuggestions([])
      setActiveIndex(-1)
      setResolvingPick(true)

      const releasePickLock = () => {
        pickLockRef.current = false
      }

      if (placeDetailsHangTimerRef.current) {
        clearTimeout(placeDetailsHangTimerRef.current)
        placeDetailsHangTimerRef.current = null
      }
      placeDetailsHangTimerRef.current = window.setTimeout(() => {
        placeDetailsHangTimerRef.current = null
        setResolvingPick(false)
        releasePickLock()
      }, GOOGLE_PLACE_DETAILS_HANG_MS)

      void loadGoogleMapsWithPlaces()
        .then(async () => {
          try {
            if (row.prediction) {
              const place = row.prediction.toPlace()
              await place.fetchFields({
                fields: ["location", "addressComponents", "formattedAddress"],
              })
              sessionTokenRef.current = null

              if (placeDetailsHangTimerRef.current) {
                clearTimeout(placeDetailsHangTimerRef.current)
                placeDetailsHangTimerRef.current = null
              }
              setResolvingPick(false)

              const coords = readPlaceLocationLatLng(place)
              if (coords) {
                const geo = newPlaceAddressComponentsToGeocoder(place.addressComponents)
                const parsed = parseGoogleAddressComponents(geo)
                const label = (place.formattedAddress ?? row.description).trim()
                if (pickSetsInputValue) onChange(label)
                onPickSuggestion({
                  label,
                  lat: coords.lat,
                  lng: coords.lng,
                  city: parsed.city || undefined,
                  state: parsed.state || undefined,
                })
                return
              }

              const fallback = await forwardGeocodeServer(row.description)
              if (fallback) {
                const label = row.description.trim()
                if (pickSetsInputValue) onChange(label)
                onPickSuggestion({
                  label,
                  lat: fallback.lat,
                  lng: fallback.lng,
                })
                return
              }
              if (pickSetsInputValue) onChange(row.description.trim())
              return
            }

            const g = window.google
            if (!g?.maps?.places) {
              throw new Error("Google Maps Places not available")
            }
            const legacyPlace = await legacyFetchPlaceDetails(g, row.placeId, [
              "address_components",
              "formatted_address",
              "geometry",
              "place_id",
            ])
            sessionTokenRef.current = null

            if (placeDetailsHangTimerRef.current) {
              clearTimeout(placeDetailsHangTimerRef.current)
              placeDetailsHangTimerRef.current = null
            }
            setResolvingPick(false)

            const geom = legacyPlace?.geometry?.location
            if (geom && legacyPlace.address_components) {
              const parsed = parseGoogleAddressComponents(legacyPlace.address_components)
              const label = (legacyPlace.formatted_address ?? row.description).trim()
              if (pickSetsInputValue) onChange(label)
              onPickSuggestion({
                label,
                lat: geom.lat(),
                lng: geom.lng(),
                city: parsed.city || undefined,
                state: parsed.state || undefined,
              })
              return
            }

            const fallback = await forwardGeocodeServer(row.description)
            if (fallback) {
              const label = row.description.trim()
              if (pickSetsInputValue) onChange(label)
              onPickSuggestion({
                label,
                lat: fallback.lat,
                lng: fallback.lng,
              })
              return
            }
            if (pickSetsInputValue) onChange(row.description.trim())
          } catch {
            if (placeDetailsHangTimerRef.current) {
              clearTimeout(placeDetailsHangTimerRef.current)
              placeDetailsHangTimerRef.current = null
            }
            setResolvingPick(false)
            const fallback = await forwardGeocodeServer(row.description)
            if (fallback) {
              const label = row.description.trim()
              if (pickSetsInputValue) onChange(label)
              onPickSuggestion({
                label,
                lat: fallback.lat,
                lng: fallback.lng,
              })
              return
            }
            if (pickSetsInputValue) onChange(row.description.trim())
          } finally {
            releasePickLock()
          }
        })
        .catch(() => {
          if (placeDetailsHangTimerRef.current) {
            clearTimeout(placeDetailsHangTimerRef.current)
            placeDetailsHangTimerRef.current = null
          }
          setResolvingPick(false)
          releasePickLock()
        })
    },
    [invalidatePending, onChange, onPickSuggestion, pickSetsInputValue],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!panelOpen) {
      if (e.key === "Escape") setOpen(false)
      if (e.key === "Enter" && onEnterWhenPanelClosed) {
        e.preventDefault()
        onEnterWhenPanelClosed()
      }
      return
    }

    if (loading || !hasResults) {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }

    const len = useGoogleLocationPath ? googleRows.length : suggestions.length
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % len)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? len - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (useGoogleLocationPath) {
        const row = googleRows[idx]
        if (row) pickGoogleRow(row)
      } else {
        const item = suggestions[idx]
        if (item) pickHttp(item)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const portalReady = panelOpen && dropdownRect && typeof document !== "undefined"

  const panelWidth = dropdownRect ? Math.max(dropdownRect.width, isAddress ? 280 : 240) : 240
  const panelLeft = dropdownRect
    ? Math.min(dropdownRect.left, typeof window !== "undefined" ? window.innerWidth - panelWidth - 12 : dropdownRect.left)
    : 0

  const showGoogleAttribution = useGoogleLocationPath && showListbox

  const dropdownPanel =
    portalReady &&
    dropdownRect &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        data-location-suggest=""
        role={showListbox ? "listbox" : loading ? "status" : !fetchEmpty ? undefined : "status"}
        aria-label={
          showListbox
            ? isAddress
              ? "Address suggestions"
              : "Location suggestions"
            : loading
              ? "Loading address suggestions"
              : fetchEmpty
                ? "No matching addresses"
                : undefined
        }
        aria-busy={loading}
        // Mouse: keep input focused when clicking panel chrome. Touch: do not preventDefault here
        // (that blocks list scrolling); option buttons handle preventDefault + pick themselves.
        onPointerDown={(e) => {
          if (e.target instanceof Element && e.target.closest("a")) return
          if (e.pointerType === "mouse") e.preventDefault()
        }}
        className={cn(
          // pointer-events-auto: Radix modal Sheet/Dialog sets body { pointer-events: none }.
          // Without this, the portaled list is visible but inert — taps hit filters underneath.
          "fixed z-[160] overflow-hidden pointer-events-auto touch-pan-y",
          isAddress
            ? "origin-top rounded-[6px] border border-neutral-200 bg-white text-neutral-900 shadow-[0_10px_40px_-4px_rgba(0,0,0,0.12)]"
            : "origin-top rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10 animate-in fade-in-0 slide-in-from-top-2 duration-200",
        )}
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: isAddress ? "min(60vh, 340px)" : "min(55vh, 320px)",
        }}
      >
        {loading ? (
          <div className="flex items-center gap-3 px-4 py-3.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <span>Searching…</span>
          </div>
        ) : fetchEmpty ? (
          <div
            className={cn(
              "flex gap-3 px-4 py-3.5",
              isAddress ? "text-[13px] text-neutral-600" : "text-sm text-muted-foreground",
            )}
          >
            {isAddress ? (
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            ) : (
              <MapPin className="h-5 w-5 shrink-0 text-muted-foreground/70 mt-0.5" aria-hidden />
            )}
            <div className="min-w-0">
              <p className={cn("font-medium", isAddress ? "text-neutral-900" : "text-foreground")}>No matches</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                {isAddress
                  ? "Try a house number and street, or add city or ZIP."
                  : "Try a US ZIP code, city name, or neighborhood — check spelling or add the state."}
              </p>
            </div>
          </div>
        ) : useGoogleLocationPath ? (
          <div className="flex max-h-[min(55vh,320px)] flex-col">
            <div className="max-h-[min(48vh,268px)] overflow-y-auto overscroll-contain py-1">
              {googleRows.map((row, idx) => (
                <button
                  key={row.placeId}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  id={`${listboxId}-opt-${idx}`}
                  className={cn(
                    "flex w-full min-h-touch cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                    "hover:bg-muted/70 active:bg-muted",
                    idx === activeIndex ? "bg-muted" : "",
                  )}
                  onPointerDown={(ev) => {
                    // Mouse only: prevent input blur so the portaled list stays mounted.
                    // Touch must not preventDefault here or the list cannot scroll.
                    if (ev.pointerType === "mouse") ev.preventDefault()
                  }}
                  onClick={() => pickGoogleRow(row)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <MapPin
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      idx === activeIndex ? "text-primary" : "text-muted-foreground/70",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        <HighlightMatch text={row.mainText} query={qTrim} />
                      </span>
                      {row.secondaryText ? (
                        <span className="text-[13px] leading-snug text-neutral-500">{row.secondaryText}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {showGoogleAttribution ? (
              <div className="border-t border-border/60 bg-muted/15 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">
                  <a
                    href="https://developers.google.com/maps/documentation/javascript/policies#logo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Powered by Google
                  </a>
                </p>
              </div>
            ) : null}
            <div className="border-t border-border/60 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">↑↓</span> move · <span className="tabular-nums">Enter</span> select ·{" "}
              <span className="tabular-nums">Esc</span> close
            </div>
          </div>
        ) : (
          <div className={cn("flex flex-col", isAddress ? "max-h-[min(60vh,340px)]" : "max-h-[min(55vh,320px)]")}>
            <div
              className={cn(
                "overflow-y-auto overscroll-contain",
                isAddress ? "max-h-[min(52vh,300px)] py-1" : "max-h-[min(48vh,268px)] py-1",
              )}
            >
              {suggestions.map((s, idx) => {
                const { primary, secondary } = splitSuggestionLabel(s.label)
                return (
                  <button
                    key={`${idx}-${s.lat}-${s.lng}-${s.label}`}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    id={`${listboxId}-opt-${idx}`}
                    className={cn(
                      "flex w-full min-h-touch cursor-pointer items-start gap-2.5 text-left transition-colors",
                      isAddress ? "border-l-[3px] px-3 py-2.5 pl-[9px]" : "px-3 py-2.5",
                      isAddress
                        ? cn(
                            "hover:bg-neutral-100/90 active:bg-neutral-100",
                            idx === activeIndex
                              ? "border-l-[#5574AD] bg-[#5574AD]/[0.06]"
                              : "border-l-transparent",
                          )
                        : cn(
                            "hover:bg-muted/70 active:bg-muted",
                            idx === activeIndex ? "bg-muted" : "",
                          ),
                    )}
                    onPointerDown={(ev) => {
                      if (ev.pointerType === "mouse") ev.preventDefault()
                    }}
                    onClick={() => pickHttp(s)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    {isAddress ? (
                      <Building2
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          idx === activeIndex ? "text-[#5574AD]" : "text-neutral-400",
                        )}
                        aria-hidden
                      />
                    ) : (
                      <MapPin
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          idx === activeIndex ? "text-primary" : "text-muted-foreground/70",
                        )}
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1 leading-snug">
                      {isAddress ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-neutral-900">
                            <HighlightMatch text={primary} query={qTrim} />
                          </span>
                          {secondary ? (
                            <span className="text-[13px] leading-snug">
                              <HighlightMatch text={secondary} query={qTrim} muted />
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <HighlightMatch text={s.label} query={qTrim} />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            {!isAddress && (
              <div className="border-t border-border/60 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">↑↓</span> move · <span className="tabular-nums">Enter</span> select ·{" "}
                <span className="tabular-nums">Esc</span> close
              </div>
            )}
          </div>
        )}
      </div>,
      document.body,
    )

  const inputBusy =
    resolvingPick ||
    (isAddress && loading) ||
    (mapsBootPending && (!endSlot || (inputFocused && qTrim.length >= minLength)))

  const inputClass = cn(
    inputClassName,
    inputBusy ? "pr-10" : "",
    !endSlot &&
      panelOpen &&
      (isAddress
        ? "ring-1 ring-[#5574AD]/30 ring-offset-0"
        : "ring-2 ring-ring/35 ring-offset-2 ring-offset-background"),
    endSlot &&
      cn(
        "h-full min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 pl-10 pr-1 text-[15px] shadow-none",
        "truncate placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
      ),
  )

  const shellCn = cn(
    SITE_FILTER_BAR_HEIGHT,
    "relative z-0 flex w-full min-w-0 items-stretch overflow-hidden rounded-full border border-border bg-background shadow-sm transition-shadow",
    "focus-within:border-cerulean/40 focus-within:ring-2 focus-within:ring-cerulean/15 focus-within:ring-offset-2 focus-within:ring-offset-background",
    panelOpen && !isAddress && "border-cerulean/40 ring-2 ring-ring/35 ring-offset-2 ring-offset-background",
  )

  const inputEl = (
    <Input
      ref={inputRef}
      id={id}
      name={name}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      autoComplete="off"
      aria-expanded={panelOpen}
      aria-busy={inputBusy}
      aria-controls={panelOpen ? listboxId : undefined}
      aria-activedescendant={
        showListbox && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
      }
      aria-autocomplete="list"
      role="combobox"
      title={endSlot && value.trim() ? value : undefined}
      onChange={(e) => {
        suppressOpenUntilTypingRef.current = false
        onChange(e.target.value)
        setOpen(true)
      }}
      onFocus={() => {
        if (blurCloseTimerRef.current) {
          window.clearTimeout(blurCloseTimerRef.current)
          blurCloseTimerRef.current = null
        }
        setInputFocused(true)
        const q = value.trim()
        if (q.length >= minLength) {
          setOpen(true)
          if (!useGoogleLocationPath) {
            const cached = readSuggestCache(q, suggestMode)
            if (cached !== undefined) {
              setSuggestions(cached)
              setFetchEmpty(cached.length === 0)
              setActiveIndex(cached.length > 0 ? 0 : -1)
            }
          }
        }
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && dropdownRef.current?.contains(next)) return
        // Touch: blur often fires before the suggestion pointer handler. Delay closing so the
        // pick can run; pointerdown preventDefault usually keeps focus anyway.
        if (blurCloseTimerRef.current) {
          window.clearTimeout(blurCloseTimerRef.current)
        }
        blurCloseTimerRef.current = window.setTimeout(() => {
          blurCloseTimerRef.current = null
          if (inputRef.current && document.activeElement === inputRef.current) return
          if (dropdownRef.current?.contains(document.activeElement)) return
          if (pickLockRef.current) return
          setInputFocused(false)
        }, 180)
      }}
      onKeyDown={onKeyDown}
      className={inputClass}
    />
  )

  return (
    <div ref={containerRef} className={cn("relative min-w-0", isAddress && "isolate", className)}>
      {endSlot ? (
        <div ref={shellRef} className={shellCn}>
          {inputEl}
          <div className="flex shrink-0 items-center pr-1.5">{endSlot}</div>
        </div>
      ) : (
        inputEl
      )}
      {inputBusy ? (
        <Loader2
          className={cn(
            "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#5574AD]/80",
            endSlot ? "right-12" : "right-3",
          )}
          aria-hidden
        />
      ) : null}
      {dropdownPanel}
    </div>
  )
}
