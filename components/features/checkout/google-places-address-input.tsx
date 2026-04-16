"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { loadGoogleMapsWithPlaces } from "@/lib/maps/load-google-maps"
import { parseGoogleAddressComponents } from "@/lib/maps/parse-google-address-components"

export type GoogleResolvedAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

interface GooglePlacesAddressInputProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  /** Called after Place Details resolves (user picked a suggestion). */
  onAddressResolved: (address: GoogleResolvedAddress) => void
  /** Maps JS API failed to load or Places returned an error — parent may fall back to OSM. */
  onProviderError?: () => void
  placeholder?: string
  inputClassName?: string
  listboxId?: string
  minLength?: number
  debounceMs?: number
  disabled?: boolean
}

type PredictionRow = {
  placeId: string
  mainText: string
  secondaryText: string
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
      <span className="font-semibold text-neutral-950">{text.slice(idx, idx + q.length)}</span>
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
  const [apiReady, setApiReady] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = useRef(0)
  const suppressOpenUntilTypingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const onProviderErrorRef = useRef(onProviderError)
  onProviderErrorRef.current = onProviderError

  const qTrim = value.trim()

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
    void loadGoogleMapsWithPlaces()
      .then((g) => {
        if (cancelled) return
        autocompleteServiceRef.current = new g.maps.places.AutocompleteService()
        setApiReady(true)
      })
      .catch(() => {
        if (!cancelled) onProviderErrorRef.current?.()
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

  useEffect(() => {
    if (disabled || !apiReady) return
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
      if (runId !== generationRef.current) return
      const svc = autocompleteServiceRef.current
      if (!svc) {
        setLoadingPredictions(false)
        return
      }

      svc.getPlacePredictions(
        {
          input: q,
          componentRestrictions: { country: "us" },
          types: ["address"],
        },
        (predictions, status) => {
          if (runId !== generationRef.current) return
          setLoadingPredictions(false)
          const g = window.google
          if (!g) return
          if (status === g.maps.places.PlacesServiceStatus.ZERO_RESULTS || !predictions?.length) {
            setRows([])
            setFetchEmpty(true)
            setActiveIndex(-1)
            const allowOpen = !suppressOpenUntilTypingRef.current
            setOpen(isInputFocused() && allowOpen)
            return
          }
          if (status !== g.maps.places.PlacesServiceStatus.OK) {
            onProviderErrorRef.current?.()
            setRows([])
            setFetchEmpty(false)
            setOpen(false)
            return
          }
          const mapped: PredictionRow[] = predictions.map((p) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description.split(",")[0]?.trim() ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          }))
          setRows(mapped)
          setFetchEmpty(mapped.length === 0)
          setActiveIndex(mapped.length > 0 ? 0 : -1)
          const allowOpen = !suppressOpenUntilTypingRef.current
          setOpen(isInputFocused() && allowOpen)
        },
      )
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, minLength, debounceMs, disabled, invalidatePending, apiReady])

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
    (placeId: string) => {
      void loadGoogleMapsWithPlaces().then((g) => {
        const svc = new g.maps.places.PlacesService(document.createElement("div"))
        setLoadingDetails(true)
        svc.getDetails(
          {
            placeId,
            fields: ["address_components"],
          },
          (place, status) => {
            setLoadingDetails(false)
            if (status !== g.maps.places.PlacesServiceStatus.OK || !place?.address_components) {
              onProviderErrorRef.current?.()
              return
            }
            const parsed = parseGoogleAddressComponents(place.address_components)
            onAddressResolved(parsed)
          },
        )
      })
    },
    [onAddressResolved],
  )

  const pick = useCallback(
    (row: PredictionRow) => {
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      setFetchEmpty(false)
      onChange(row.mainText)
      resolvePlace(row.placeId)
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
                    idx === activeIndex ? "border-l-[#3b63e3] bg-[#3b63e3]/[0.06]" : "border-l-transparent",
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
          panelOpen && "ring-1 ring-[#3b63e3]/30 ring-offset-0",
        )}
      />
      {(!apiReady || loadingPredictions || loadingDetails) && !disabled ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#3b63e3]/80" />
      ) : null}
      {dropdownPanel}
    </div>
  )
}
