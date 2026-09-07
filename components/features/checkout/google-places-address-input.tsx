"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { loadGoogleMapsWithPlaces } from "@/lib/maps/load-google-maps"
import {
  choosePlacesAutocompleteBackend,
  legacyFetchAddressPredictions,
  legacyFetchPlaceDetails,
} from "@/lib/maps/places-legacy-autocomplete"
import {
  AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES,
  createAutocompleteSessionToken,
  fetchAutocompletePlacePredictions,
  newPlaceAddressComponentsToGeocoder,
  readPlaceLocationLatLng,
  suggestionToRowTexts,
  type AutocompleteSuggestionItem,
  type PlacePredictionHandle,
} from "@/lib/maps/places-autocomplete-new"
import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"

/** If Maps JS never settles, fall back (checkout OSM) instead of spinning forever. */
const GOOGLE_MAPS_BOOT_HANG_MS = 12_000
/** If autocomplete fetch hangs, stop showing an in-field spinner. */
const GOOGLE_PREDICTION_HANG_MS = 12_000
/** If Place Details never returns after a pick, clear resolving state. */
const GOOGLE_PLACE_DETAILS_HANG_MS = 15_000

export type GoogleResolvedAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export type GoogleFullPlaceResolved = {
  formattedAddress: string
  latitude: number
  longitude: number
  placeId: string
  address: GoogleResolvedAddress
}

interface GooglePlacesAddressInputProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  /** Called after Place Details resolves (user picked a suggestion). */
  onAddressResolved?: (address: GoogleResolvedAddress) => void
  /**
   * When set, Place Details loads geometry + formatted address (for pins, messaging, etc.).
   * You can combine with `onAddressResolved` when both structured fields and coordinates are needed.
   */
  onFullPlaceResolved?: (place: GoogleFullPlaceResolved) => void
  /** Maps JS API failed to load or Places returned an error — parent may fall back to OSM. */
  onProviderError?: () => void
  placeholder?: string
  inputClassName?: string
  listboxId?: string
  minLength?: number
  debounceMs?: number
  disabled?: boolean
}

type PlacesAutocompleteBackend = "new" | "legacy"

type PredictionRow = {
  placeId: string
  mainText: string
  secondaryText: string
  /** Set when using Places API (New) programmatic autocomplete. */
  prediction?: PlacePredictionHandle
}

function mapAddressSuggestions(suggestions: readonly AutocompleteSuggestionItem[]): PredictionRow[] {
  const out: PredictionRow[] = []
  for (const s of suggestions) {
    const mapped = suggestionToRowTexts(s)
    if (!mapped) continue
    out.push({
      placeId: mapped.placeId,
      mainText: mapped.mainText,
      secondaryText: mapped.secondaryText,
      prediction: mapped.prediction,
    })
  }
  return out
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-foreground">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  )
}

export function GooglePlacesAddressInput({
  id,
  name = "address-line1",
  value,
  onChange,
  onAddressResolved,
  onFullPlaceResolved,
  onProviderError,
  placeholder = "Street number and name",
  inputClassName = "",
  listboxId = "google-places-address-listbox",
  minLength = 2,
  debounceMs = 180,
  disabled = false,
}: GooglePlacesAddressInputProps) {
  const [open, setOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [rows, setRows] = useState<PredictionRow[]>([])
  const [fetchEmpty, setFetchEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [placesBackend, setPlacesBackend] = useState<PlacesAutocompleteBackend | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = useRef(0)
  const suppressOpenUntilTypingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const predictHangTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detailsHangTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onProviderErrorRef = useRef(onProviderError)
  onProviderErrorRef.current = onProviderError

  const clearPredictHangTimer = () => {
    if (predictHangTimerRef.current) {
      clearTimeout(predictHangTimerRef.current)
      predictHangTimerRef.current = null
    }
  }

  const clearDetailsHangTimer = () => {
    if (detailsHangTimerRef.current) {
      clearTimeout(detailsHangTimerRef.current)
      detailsHangTimerRef.current = null
    }
  }

  const qTrim = value.trim()
  const apiReady = placesBackend !== null

  const panelOpen =
    open &&
    inputFocused &&
    apiReady &&
    qTrim.length >= minLength &&
    !loadingPredictions &&
    !suppressOpenUntilTypingRef.current &&
    (rows.length > 0 || fetchEmpty)

  useEffect(() => {
    let cancelled = false
    const bootHang = window.setTimeout(() => {
      if (cancelled) return
      onProviderErrorRef.current?.()
    }, GOOGLE_MAPS_BOOT_HANG_MS)

    void loadGoogleMapsWithPlaces()
      .then((g) => {
        if (cancelled) return
        window.clearTimeout(bootHang)
        const mode = choosePlacesAutocompleteBackend(g)
        if (mode === "legacy") {
          autocompleteServiceRef.current = new g.maps.places.AutocompleteService()
        }
        setPlacesBackend(mode)
      })
      .catch(() => {
        if (cancelled) return
        window.clearTimeout(bootHang)
        onProviderErrorRef.current?.()
      })
    return () => {
      cancelled = true
      window.clearTimeout(bootHang)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (predictHangTimerRef.current) clearTimeout(predictHangTimerRef.current)
      if (detailsHangTimerRef.current) clearTimeout(detailsHangTimerRef.current)
    }
  }, [])

  const invalidatePending = useCallback(() => {
    generationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    clearPredictHangTimer()
    setLoadingPredictions(false)
  }, [])

  const isInputFocused = () =>
    Boolean(inputRef.current && document.activeElement === inputRef.current)

  useEffect(() => {
    if (disabled || !placesBackend) return
    const q = value.trim()
    if (q.length < minLength) {
      invalidatePending()
      setRows([])
      setOpen(false)
      setLoadingPredictions(false)
      setFetchEmpty(false)
      setActiveIndex(-1)
      return
    }

    // After a pick, the street line is already filled — don't refetch (or spin) until they type.
    if (suppressOpenUntilTypingRef.current) {
      clearPredictHangTimer()
      setLoadingPredictions(false)
      setRows([])
      setOpen(false)
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
    clearPredictHangTimer()

    setLoadingPredictions(true)
    setRows([])
    setActiveIndex(-1)

    const backend = placesBackend

    const finishPredictions = () => {
      if (runId !== generationRef.current) return
      clearPredictHangTimer()
      setLoadingPredictions(false)
    }

    debounceRef.current = setTimeout(() => {
      predictHangTimerRef.current = setTimeout(() => {
        predictHangTimerRef.current = null
        if (runId !== generationRef.current) return
        setLoadingPredictions(false)
      }, GOOGLE_PREDICTION_HANG_MS)

      if (backend === "new") {
        void (async () => {
          if (runId !== generationRef.current) return
          const g = window.google
          if (!g?.maps?.places) {
            finishPredictions()
            onProviderErrorRef.current?.()
            return
          }

          try {
            if (!sessionTokenRef.current) {
              sessionTokenRef.current = createAutocompleteSessionToken(g) ?? null
            }
            const suggestions = await fetchAutocompletePlacePredictions(g, {
              input: q,
              sessionToken: sessionTokenRef.current ?? undefined,
              includedRegionCodes: ["US"],
              region: "us",
              language: "en",
              includedPrimaryTypes: [...AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES],
            })
            if (runId !== generationRef.current) return
            const mapped = mapAddressSuggestions(suggestions)
            finishPredictions()
            if (mapped.length === 0) {
              setRows([])
              setFetchEmpty(true)
              setActiveIndex(-1)
              const allowOpen = !suppressOpenUntilTypingRef.current
              setOpen(isInputFocused() && allowOpen)
              return
            }
            setRows(mapped)
            setFetchEmpty(mapped.length === 0)
            setActiveIndex(mapped.length > 0 ? 0 : -1)
            const allowOpen = !suppressOpenUntilTypingRef.current
            setOpen(isInputFocused() && allowOpen)
          } catch {
            if (runId !== generationRef.current) return
            try {
              const g = window.google
              if (!g?.maps?.places) throw new Error("no places")
              if (!autocompleteServiceRef.current) {
                autocompleteServiceRef.current = new g.maps.places.AutocompleteService()
              }
              const list = await legacyFetchAddressPredictions(g, autocompleteServiceRef.current, q)
              if (runId !== generationRef.current) return
              setPlacesBackend("legacy")
              finishPredictions()
              if (list.length === 0) {
                setRows([])
                setFetchEmpty(true)
                setActiveIndex(-1)
                const allowOpen = !suppressOpenUntilTypingRef.current
                setOpen(isInputFocused() && allowOpen)
                return
              }
              setRows(
                list.map((p) => ({
                  placeId: p.placeId,
                  mainText: p.mainText,
                  secondaryText: p.secondaryText,
                })),
              )
              setFetchEmpty(false)
              setActiveIndex(0)
              const allowOpen = !suppressOpenUntilTypingRef.current
              setOpen(isInputFocused() && allowOpen)
            } catch {
              finishPredictions()
              onProviderErrorRef.current?.()
              setRows([])
              setFetchEmpty(false)
              setOpen(false)
            }
          }
        })()
        return
      }

      // legacy AutocompleteService
      void (async () => {
        if (runId !== generationRef.current) return
        const g = window.google
        const svc = autocompleteServiceRef.current
        if (!g?.maps?.places || !svc) {
          finishPredictions()
          onProviderErrorRef.current?.()
          return
        }
        try {
          const list = await legacyFetchAddressPredictions(g, svc, q)
          if (runId !== generationRef.current) return
          finishPredictions()
          if (list.length === 0) {
            setRows([])
            setFetchEmpty(true)
            setActiveIndex(-1)
            const allowOpen = !suppressOpenUntilTypingRef.current
            setOpen(isInputFocused() && allowOpen)
            return
          }
          setRows(
            list.map((p) => ({
              placeId: p.placeId,
              mainText: p.mainText,
              secondaryText: p.secondaryText,
            })),
          )
          setFetchEmpty(false)
          setActiveIndex(0)
          const allowOpen = !suppressOpenUntilTypingRef.current
          setOpen(isInputFocused() && allowOpen)
        } catch {
          if (runId !== generationRef.current) return
          finishPredictions()
          onProviderErrorRef.current?.()
          setRows([])
          setFetchEmpty(false)
          setOpen(false)
        }
      })()
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, minLength, debounceMs, disabled, invalidatePending, placesBackend])

  useEffect(() => {
    if (!panelOpen || !containerRef.current) {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [panelOpen])

  useEffect(() => {
    if (!panelOpen || activeIndex < 0) return
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, panelOpen, listboxId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      invalidatePending()
      setOpen(false)
      setActiveIndex(-1)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [invalidatePending])

  const resolvePlace = useCallback(
    (row: PredictionRow) => {
      setLoadingDetails(true)
      clearDetailsHangTimer()
      detailsHangTimerRef.current = setTimeout(() => {
        detailsHangTimerRef.current = null
        setLoadingDetails(false)
      }, GOOGLE_PLACE_DETAILS_HANG_MS)

      void loadGoogleMapsWithPlaces()
        .then(async (g) => {
          try {
            if (row.prediction) {
              const place = row.prediction.toPlace()
              const fields = onFullPlaceResolved
                ? (["addressComponents", "formattedAddress", "location", "id"] as const)
                : (["addressComponents"] as const)
              await place.fetchFields({ fields: [...fields] })
              sessionTokenRef.current = null
              clearDetailsHangTimer()
              setLoadingDetails(false)

              const geo = newPlaceAddressComponentsToGeocoder(place.addressComponents)
              if (!geo.length) {
                onProviderErrorRef.current?.()
                return
              }
              const parsed = parseGoogleAddressComponents(geo)
              onAddressResolved?.(parsed)

              if (onFullPlaceResolved) {
                const coords = readPlaceLocationLatLng(place)
                const formattedAddress = (place.formattedAddress ?? "").trim()
                const resolvedPlaceId = (place.id ?? row.placeId).trim()
                const latNum = coords?.lat ?? NaN
                const lngNum = coords?.lng ?? NaN
                if (
                  formattedAddress &&
                  resolvedPlaceId &&
                  Number.isFinite(latNum) &&
                  Number.isFinite(lngNum)
                ) {
                  onFullPlaceResolved({
                    formattedAddress,
                    latitude: latNum,
                    longitude: lngNum,
                    placeId: resolvedPlaceId,
                    address: parsed,
                  })
                } else {
                  onProviderErrorRef.current?.()
                }
              }
              return
            }

            const fields = onFullPlaceResolved
              ? (["address_components", "formatted_address", "geometry", "place_id"] as const)
              : (["address_components"] as const)
            const place = await legacyFetchPlaceDetails(g, row.placeId, [...fields])
            clearDetailsHangTimer()
            setLoadingDetails(false)
            if (!place?.address_components) {
              onProviderErrorRef.current?.()
              return
            }
            const parsed = parseGoogleAddressComponents(place.address_components)
            onAddressResolved?.(parsed)

            if (onFullPlaceResolved) {
              const geom = place.geometry?.location
              const formattedAddress =
                typeof place.formatted_address === "string" ? place.formatted_address.trim() : ""
              const resolvedPlaceId = typeof place.place_id === "string" ? place.place_id : ""
              const latNum = geom ? geom.lat() : NaN
              const lngNum = geom ? geom.lng() : NaN
              if (
                formattedAddress &&
                resolvedPlaceId &&
                Number.isFinite(latNum) &&
                Number.isFinite(lngNum)
              ) {
                onFullPlaceResolved({
                  formattedAddress,
                  latitude: latNum,
                  longitude: lngNum,
                  placeId: resolvedPlaceId,
                  address: parsed,
                })
              } else {
                onProviderErrorRef.current?.()
              }
            }
          } catch {
            clearDetailsHangTimer()
            setLoadingDetails(false)
            onProviderErrorRef.current?.()
          }
        })
        .catch(() => {
          clearDetailsHangTimer()
          setLoadingDetails(false)
          onProviderErrorRef.current?.()
        })
    },
    [onAddressResolved, onFullPlaceResolved],
  )

  const pick = useCallback(
    (row: PredictionRow) => {
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      setFetchEmpty(false)
      onChange(row.mainText)
      resolvePlace(row)
      setOpen(false)
      setRows([])
      setActiveIndex(-1)
    },
    [invalidatePending, onChange, resolvePlace],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!panelOpen) {
      if (e.key === "Escape") setOpen(false)
      return
    }

    const hasResults = rows.length > 0
    if (loadingPredictions || !hasResults) {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % rows.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const row = rows[activeIndex >= 0 ? activeIndex : 0]
      if (row) pick(row)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const portalReady = panelOpen && dropdownRect && typeof document !== "undefined"
  const panelWidth = dropdownRect ? Math.max(dropdownRect.width, 280) : 280
  const panelLeft = dropdownRect
    ? Math.min(dropdownRect.left, typeof window !== "undefined" ? window.innerWidth - panelWidth - 12 : dropdownRect.left)
    : 0

  const showListbox = panelOpen && rows.length > 0 && !loadingPredictions

  const dropdownPanel =
    portalReady &&
    dropdownRect &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role={showListbox ? "listbox" : fetchEmpty ? "status" : undefined}
        aria-label={showListbox ? "Address suggestions" : fetchEmpty ? "No matching addresses" : undefined}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "fixed z-[100] overflow-hidden rounded-[6px] border border-neutral-200 bg-white text-neutral-900",
          "shadow-[0_10px_40px_-4px_rgba(0,0,0,0.12)]",
        )}
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(60vh, 340px)",
        }}
      >
        {fetchEmpty ? (
          <div className="flex gap-3 px-4 py-3.5 text-[13px] text-neutral-600">
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">No matches</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Try a full street with number, or add city or ZIP.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[min(60vh,340px)] flex-col">
            <div className="max-h-[min(52vh,300px)] overflow-y-auto overscroll-contain py-1">
              {rows.map((row, idx) => (
                <button
                  key={row.placeId}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  id={`${listboxId}-opt-${idx}`}
                  className={cn(
                    "flex w-full min-h-touch cursor-pointer items-start gap-2.5 border-l-[3px] px-3 py-2.5 pl-[9px] text-left transition-colors",
                    "hover:bg-neutral-100/90 active:bg-neutral-100",
                    idx === activeIndex ? "border-l-[#5574AD] bg-[#5574AD]/[0.06]" : "border-l-transparent",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    pick(row)
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-neutral-900">
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
            <div className="border-t border-neutral-200/90 px-3 py-2">
              <p className="text-[10px] text-neutral-400">
                <a
                  href="https://developers.google.com/maps/documentation/javascript/policies#logo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
                >
                  Powered by Google
                </a>
              </p>
            </div>
          </div>
        )}
      </div>,
      document.body,
    )

  return (
    <div ref={containerRef} className="relative isolate min-w-0">
      <Input
        ref={inputRef}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-expanded={panelOpen}
        aria-busy={loadingPredictions || loadingDetails}
        aria-controls={panelOpen ? listboxId : undefined}
        aria-activedescendant={
          showListbox && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        role="combobox"
        onChange={(e) => {
          suppressOpenUntilTypingRef.current = false
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setInputFocused(true)
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null
          if (next && dropdownRef.current?.contains(next)) return
          setInputFocused(false)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          inputClassName,
          (loadingPredictions || loadingDetails) && "pr-10",
          panelOpen && "ring-1 ring-[#5574AD]/30 ring-offset-0",
        )}
      />
      {(loadingPredictions || loadingDetails) && !disabled ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#5574AD]/80" />
      ) : null}
      {dropdownPanel}
    </div>
  )
}
