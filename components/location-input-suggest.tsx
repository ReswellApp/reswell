"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Building2, Loader2, MapPin } from "lucide-react"

export type LocationSuggestion = {
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
}

type SuggestMode = "location" | "address"

interface LocationInputSuggestProps {
  value: string
  onChange: (value: string) => void
  /** When the user picks a row, coords are known so Apply can skip a second geocode. */
  onPickSuggestion: (place: LocationSuggestion) => void
  /** Use `/api/geocode/suggest?address=1` for US street-level matches (checkout, admin shipping). */
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
}

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
    : "font-semibold text-neutral-950"
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
}: LocationInputSuggestProps) {
  const [open, setOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [fetchEmpty, setFetchEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const suppressOpenUntilTypingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const qTrim = value.trim()
  const isAddress = suggestMode === "address"
  /** Address mode: dropdown opens once we have a response (keeps focus on the field while loading). */
  const panelOpen =
    open &&
    inputFocused &&
    qTrim.length >= minLength &&
    !suppressOpenUntilTypingRef.current &&
    (suggestions.length > 0 ||
      fetchEmpty ||
      (!isAddress && loading))

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

  useEffect(() => {
    if (disabled) return
    const q = value.trim()
    if (q.length < minLength) {
      invalidatePending()
      setSuggestions([])
      setOpen(false)
      setLoading(false)
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

    const cachedImmediate = readSuggestCache(q, suggestMode)
    if (cachedImmediate !== undefined) {
      if (runId !== generationRef.current) return
      setSuggestions(cachedImmediate)
      setFetchEmpty(cachedImmediate.length === 0)
      setActiveIndex(cachedImmediate.length > 0 ? 0 : -1)
      setLoading(false)
      const allowOpen = !suppressOpenUntilTypingRef.current
      setOpen(isInputFocused() && allowOpen)
      return
    }

    setLoading(true)
    setSuggestions([])
    setActiveIndex(-1)

    debounceRef.current = setTimeout(() => {
      if (runId !== generationRef.current) return

      const cached = readSuggestCache(q, suggestMode)
      if (cached !== undefined) {
        setSuggestions(cached)
        setFetchEmpty(cached.length === 0)
        setActiveIndex(cached.length > 0 ? 0 : -1)
        const allowOpen = !suppressOpenUntilTypingRef.current
        setOpen(isInputFocused() && allowOpen)
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
          setOpen(isInputFocused() && allowOpen)
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
  }, [value, minLength, debounceMs, disabled, invalidatePending, suggestMode])

  const hasResults = suggestions.length > 0
  const showListbox = panelOpen && hasResults && !loading

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
    if (!showListbox || activeIndex < 0) return
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, showListbox, listboxId])

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

  const pick = useCallback(
    (item: LocationSuggestion) => {
      invalidatePending()
      suppressOpenUntilTypingRef.current = true
      setFetchEmpty(false)
      if (pickSetsInputValue) {
        onChange(item.label)
      }
      onPickSuggestion(item)
      setOpen(false)
      setSuggestions([])
      setActiveIndex(-1)
    },
    [invalidatePending, onChange, onPickSuggestion, pickSetsInputValue],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!panelOpen) {
      if (e.key === "Escape") setOpen(false)
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

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = suggestions[activeIndex >= 0 ? activeIndex : 0]
      if (item) pick(item)
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

  const dropdownPanel =
    portalReady &&
    dropdownRect &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
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
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "fixed z-[100] overflow-hidden",
          isAddress
            ? "rounded-[6px] border border-neutral-200 bg-white text-neutral-900 shadow-[0_10px_40px_-4px_rgba(0,0,0,0.12)]"
            : "rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95 duration-150",
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
                              ? "border-l-[#3b63e3] bg-[#3b63e3]/[0.06]"
                              : "border-l-transparent",
                          )
                        : cn(
                            "hover:bg-muted/70 active:bg-muted",
                            idx === activeIndex ? "bg-muted" : "",
                          ),
                    )}
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      pick(s)
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    {isAddress ? (
                      <Building2
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          idx === activeIndex ? "text-[#3b63e3]" : "text-neutral-400",
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

  return (
    <div ref={containerRef} className={cn("relative min-w-0", isAddress && "isolate", className)}>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-expanded={panelOpen}
        aria-busy={loading}
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
          const q = value.trim()
          if (q.length >= minLength) {
            setOpen(true)
            const cached = readSuggestCache(q, suggestMode)
            if (cached !== undefined) {
              setSuggestions(cached)
              setFetchEmpty(cached.length === 0)
              setActiveIndex(cached.length > 0 ? 0 : -1)
            }
          }
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null
          if (next && dropdownRef.current?.contains(next)) return
          setInputFocused(false)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          inputClassName,
          isAddress && loading && "pr-10",
          panelOpen &&
            (isAddress
              ? "ring-1 ring-[#3b63e3]/30 ring-offset-0"
              : "ring-2 ring-ring/35 ring-offset-2 ring-offset-background"),
        )}
      />
      {isAddress && loading ? (
        <Loader2
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#3b63e3]/80"
          aria-hidden
        />
      ) : null}
      {dropdownPanel}
    </div>
  )
}
