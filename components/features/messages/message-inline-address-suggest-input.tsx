"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  loadGoogleMapsWithPlaces,
} from "@/lib/maps/load-google-maps"
import {
  AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES,
  createAutocompleteSessionToken,
  fetchAutocompletePlacePredictions,
  mapsPlacesSupportsNewAutocomplete,
  newPlaceAddressComponentsToGeocoder,
  readPlaceLocationLatLng,
  suggestionToRowTexts,
  type AutocompleteSuggestionItem,
  type PlacePredictionHandle,
} from "@/lib/maps/places-autocomplete-new"
import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"
import type { GoogleFullPlaceResolved } from "@/components/features/checkout/google-places-address-input"

/** When true, we run Places address autocomplete (reduces noise for normal chat). */
export function messageComposerLooksLikeAddressQuery(raw: string): boolean {
  const q = raw.trim()
  if (q.length < 3) return false
  if (/^\d{1,5}(\s|$)/.test(q)) return true
  if (q.includes(",")) return true
  if (
    q.length >= 8 &&
    /\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|hwy|route|pkwy)\b/i.test(
      q,
    )
  ) {
    return true
  }
  return false
}

type PredictionRow = {
  placeId: string
  mainText: string
  secondaryText: string
  prediction: PlacePredictionHandle
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
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>
  const lower = text.toLowerCase()
  const idx = lower.indexOf(trimmed.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-foreground">{text.slice(idx, idx + trimmed.length)}</span>
      {text.slice(idx + trimmed.length)}
    </>
  )
}

const PANEL_MAX_H = 288
const DEBOUNCE_MS = 200
const MIN_CHARS = 3

function suggestPopoverWidth(px: number): number {
  if (typeof window === "undefined") return Math.max(px, 280)
  return Math.max(px, Math.min(360, Math.max(280, window.innerWidth - 24)))
}

interface MessageInlineAddressSuggestInputProps {
  value: string
  onChange: (value: string) => void
  onPickAddress: (place: GoogleFullPlaceResolved) => Promise<{ ok: boolean }>
  disabled?: boolean
  className?: string
  id?: string
  placeholder?: string
}

export function MessageInlineAddressSuggestInput({
  value,
  onChange,
  onPickAddress,
  disabled = false,
  className,
  id,
  placeholder = "Message",
}: MessageInlineAddressSuggestInputProps) {
  const listboxId = `${useId()}-msg-addr-suggest`
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [rows, setRows] = useState<PredictionRow[]>([])
  const [fetchEmpty, setFetchEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownLayout, setDropdownLayout] = useState<{
    anchorTop: number
    anchorBottom: number
    left: number
    width: number
  } | null>(null)
  const [openUpward, setOpenUpward] = useState(true)
  const [apiReady, setApiReady] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = useRef(0)
  const suppressOpenUntilTypingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  const qTrim = value.trim()
  const queryLooksAddress = useMemo(() => messageComposerLooksLikeAddressQuery(value), [value])

  const panelOpen =
    open &&
    inputFocused &&
    apiReady &&
    queryLooksAddress &&
    qTrim.length >= MIN_CHARS &&
    !loadingPredictions &&
    !suppressOpenUntilTypingRef.current &&
    (rows.length > 0 || fetchEmpty)

  useEffect(() => {
    let cancelled = false
    void loadGoogleMapsWithPlaces()
      .then((g) => {
        if (cancelled) return
        if (!mapsPlacesSupportsNewAutocomplete(g)) {
          setApiReady(false)
          return
        }
        setApiReady(true)
      })
      .catch(() => {
        if (!cancelled) setApiReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const invalidatePending = useCallback(() => {
    generationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const isInputFocused = () =>
    Boolean(inputRef.current && document.activeElement === inputRef.current)

  const measureAndPlace = useCallback(() => {
    const el = containerRef.current
    if (!el || typeof window === "undefined") return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 16
    const spaceAbove = rect.top - 16
    const openUp = spaceBelow < PANEL_MAX_H && spaceAbove > spaceBelow
    setOpenUpward(openUp)
    setDropdownLayout({
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!panelOpen || !containerRef.current) {
      setDropdownLayout(null)
      return
    }
    measureAndPlace()
    const onScrollResize = () => measureAndPlace()
    window.addEventListener("scroll", onScrollResize, true)
    window.addEventListener("resize", onScrollResize)
    return () => {
      window.removeEventListener("scroll", onScrollResize, true)
      window.removeEventListener("resize", onScrollResize)
    }
  }, [panelOpen, measureAndPlace, rows.length])

  useEffect(() => {
    if (disabled || !apiReady || !queryLooksAddress) {
      invalidatePending()
      setRows([])
      setOpen(false)
      setLoadingPredictions(false)
      setFetchEmpty(false)
      setActiveIndex(-1)
      return
    }
    const q = qTrim
    if (q.length < MIN_CHARS) {
      invalidatePending()
      setRows([])
      setOpen(false)
      setLoadingPredictions(false)
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

    setLoadingPredictions(true)
    setRows([])
    setActiveIndex(-1)

    debounceRef.current = setTimeout(() => {
      void (async () => {
        if (runId !== generationRef.current) return
        const g = window.google
        if (!g?.maps?.places) {
          setLoadingPredictions(false)
          return
        }

        try {
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = createAutocompleteSessionToken(g) ?? null
          }
          const suggestions = await fetchAutocompletePlacePredictions(g, {
            input: q,
            sessionToken: sessionTokenRef.current ?? undefined,
            includedRegionCodes: ["us"],
            includedPrimaryTypes: [...AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES],
          })
          if (runId !== generationRef.current) return
          setLoadingPredictions(false)
          const mapped = mapAddressSuggestions(suggestions)
          if (!mapped.length) {
            setRows([])
            setFetchEmpty(true)
            setActiveIndex(-1)
            setOpen(isInputFocused() && !suppressOpenUntilTypingRef.current)
            return
          }
          setRows(mapped)
          setFetchEmpty(mapped.length === 0)
          setActiveIndex(mapped.length > 0 ? 0 : -1)
          setOpen(isInputFocused() && !suppressOpenUntilTypingRef.current)
        } catch {
          if (runId !== generationRef.current) return
          setLoadingPredictions(false)
          setRows([])
          setFetchEmpty(false)
          setOpen(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, qTrim, disabled, invalidatePending, apiReady, queryLooksAddress])

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

  const resolveAndSend = useCallback(
    (row: PredictionRow) => {
      const typedBackup = inputRef.current?.value ?? value

      void loadGoogleMapsWithPlaces()
        .then(async () => {
          let detailsReturned = false
          const releaseLoading = () => {
            if (detailsReturned) return
            detailsReturned = true
            setLoadingDetails(false)
          }

          try {
            setLoadingDetails(true)

            const safetyMs = 20_000
            const safetyId = window.setTimeout(() => {
              releaseLoading()
            }, safetyMs)

            const place = row.prediction.toPlace()
            await place.fetchFields({
              fields: ["addressComponents", "formattedAddress", "location", "id"],
            })
            sessionTokenRef.current = null

            window.clearTimeout(safetyId)
            releaseLoading()

            const geo = newPlaceAddressComponentsToGeocoder(place.addressComponents)
            const coords = readPlaceLocationLatLng(place)
            const formatted = (place.formattedAddress ?? "").trim()
            const placeId = (place.id ?? row.placeId).trim()
            if (!geo.length || !coords || !formatted || !placeId) {
              return
            }
            const parsed = parseGoogleAddressComponents(geo)
            const latNum = coords.lat
            const lngNum = coords.lng
            if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return

            const full: GoogleFullPlaceResolved = {
              formattedAddress: formatted,
              latitude: latNum,
              longitude: lngNum,
              placeId,
              address: parsed,
            }

            invalidatePending()
            suppressOpenUntilTypingRef.current = true
            setOpen(false)
            setRows([])
            setActiveIndex(-1)
            onChange("")
            const { ok } = await onPickAddress(full)
            if (!ok && typedBackup !== "") {
              onChange(typedBackup)
            }
            requestAnimationFrame(() => {
              suppressOpenUntilTypingRef.current = false
            })
          } catch {
            releaseLoading()
          }
        })
        .catch(() => {
          setLoadingDetails(false)
        })
    },
    [invalidatePending, onChange, onPickAddress, value],
  )

  const pick = useCallback(
    (row: PredictionRow) => {
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      void resolveAndSend(row)
    },
    [invalidatePending, resolveAndSend],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!panelOpen) return

    const hasResults = rows.length > 0
    if (!hasResults || loadingPredictions || loadingDetails) {
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

  const qTrimDisplay = qTrim
  const showListbox = panelOpen && rows.length > 0 && !loadingPredictions

  const panelStyle = useMemo((): Record<string, string | number> | null => {
    if (!dropdownLayout || typeof window === "undefined") return null
    const panelWidth = suggestPopoverWidth(dropdownLayout.width)
    const panelLeft = Math.min(
      dropdownLayout.left,
      Math.max(12, window.innerWidth - panelWidth - 12),
    )
    const gap = 8
    const maxH = Math.min(
      PANEL_MAX_H,
      openUpward
        ? dropdownLayout.anchorTop - gap - 8
        : window.innerHeight - dropdownLayout.anchorBottom - gap - 8,
    )
    const safeMax = Math.max(120, maxH)
    if (openUpward) {
      return {
        position: "fixed",
        left: panelLeft,
        width: panelWidth,
        bottom: window.innerHeight - dropdownLayout.anchorTop + gap,
        maxHeight: safeMax,
        zIndex: 100,
      }
    }
    return {
      position: "fixed",
      top: dropdownLayout.anchorBottom + gap,
      left: panelLeft,
      width: panelWidth,
      maxHeight: safeMax,
      zIndex: 100,
    }
  }, [dropdownLayout, openUpward])

  const portalReady = panelOpen && panelStyle !== null && typeof document !== "undefined"

  const dropdownPanel =
    portalReady &&
    panelStyle &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role={showListbox ? "listbox" : fetchEmpty ? "status" : undefined}
        aria-label={showListbox ? "Address suggestions" : fetchEmpty ? "No matching addresses" : undefined}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
        )}
        style={panelStyle}
      >
        {fetchEmpty && !showListbox ? (
          <div className="px-3 py-2.5 text-[13px] text-muted-foreground">
            No address matches. Keep typing or pick from the map pin menu.
          </div>
        ) : (
          <div className="flex max-h-[min(72vh,288px)] flex-col">
            <div className="max-h-[min(60vh,252px)] overflow-y-auto overscroll-contain py-1">
              {rows.map((row, idx) => (
                <button
                  key={row.placeId}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  id={`${listboxId}-opt-${idx}`}
                  className={cn(
                    "flex w-full min-h-touch cursor-pointer items-start gap-2 border-l-[3px] px-3 py-2.5 pl-[9px] text-left transition-colors",
                    "hover:bg-muted/80 active:bg-muted",
                    idx === activeIndex ? "border-l-primary bg-muted/50" : "border-l-transparent",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    pick(row)
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium text-foreground">
                        <HighlightMatch text={row.mainText} query={qTrimDisplay} />
                      </span>
                      {row.secondaryText ? (
                        <span className="text-[13px] leading-snug text-muted-foreground">
                          {row.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-border/60 px-3 py-1.5">
              <p className="mb-1 text-[11px] leading-snug text-muted-foreground">
                Tap an address to send it as a location pin.
              </p>
              <p className="text-[10px] text-muted-foreground">
                <a
                  href="https://developers.google.com/maps/documentation/javascript/policies#logo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
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
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          suppressOpenUntilTypingRef.current = false
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setInputFocused(true)
          measureAndPlace()
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null
          if (next && dropdownRef.current?.contains(next)) return
          setInputFocused(false)
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled || loadingDetails}
        autoComplete="off"
        aria-expanded={panelOpen}
        aria-busy={loadingPredictions || loadingDetails}
        aria-controls={panelOpen ? listboxId : undefined}
        aria-activedescendant={
          showListbox && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        role="combobox"
        className={cn(
          className,
          (loadingPredictions || loadingDetails) && "pr-10",
          panelOpen && "ring-1 ring-primary/25 ring-offset-0",
        )}
      />
      {(!apiReady || loadingPredictions || loadingDetails) && !disabled ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {dropdownPanel}
    </div>
  )
}
