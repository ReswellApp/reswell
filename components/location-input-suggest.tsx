"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"

export type LocationSuggestion = { label: string; lat: number; lng: number }

interface LocationInputSuggestProps {
  value: string
  onChange: (value: string) => void
  /** When the user picks a row, coords are known so Apply can skip a second geocode. */
  onPickSuggestion: (place: LocationSuggestion) => void
  name?: string
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

function cacheKey(q: string) {
  return q.trim().toLowerCase()
}

function readSuggestCache(q: string): LocationSuggestion[] | undefined {
  const k = cacheKey(q)
  if (k.length < 2) return undefined
  const v = locationSuggestCache.get(k)
  if (!v) return undefined
  locationSuggestCache.delete(k)
  locationSuggestCache.set(k, v)
  return v
}

function writeSuggestCache(q: string, suggestions: LocationSuggestion[]) {
  const k = cacheKey(q)
  if (k.length < 2) return
  if (locationSuggestCache.has(k)) locationSuggestCache.delete(k)
  locationSuggestCache.set(k, suggestions)
  while (locationSuggestCache.size > LOCATION_SUGGEST_CACHE_MAX) {
    const oldest = locationSuggestCache.keys().next().value
    locationSuggestCache.delete(oldest)
  }
}

async function fetchSuggestions(q: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { suggestions?: LocationSuggestion[] }
  return Array.isArray(data.suggestions) ? data.suggestions : []
}

/** Bold the substring of `text` that best matches what the user typed. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>

  const lower = text.toLowerCase()
  const fullIdx = lower.indexOf(q.toLowerCase())
  if (fullIdx >= 0) {
    return (
      <>
        {text.slice(0, fullIdx)}
        <span className="font-semibold text-foreground">{text.slice(fullIdx, fullIdx + q.length)}</span>
        {text.slice(fullIdx + q.length)}
      </>
    )
  }

  const word = q.split(/\s+/).find((w) => w.length >= 2) ?? ""
  if (!word) return <>{text}</>
  const wi = lower.indexOf(word.toLowerCase())
  if (wi < 0) return <>{text}</>

  return (
    <>
      {text.slice(0, wi)}
      <span className="font-semibold text-foreground">{text.slice(wi, wi + word.length)}</span>
      {text.slice(wi + word.length)}
    </>
  )
}

export function LocationInputSuggest({
  value,
  onChange,
  onPickSuggestion,
  name = "location",
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
  const panelOpen =
    open &&
    inputFocused &&
    qTrim.length >= minLength &&
    !loading &&
    (suggestions.length > 0 || fetchEmpty) &&
    !suppressOpenUntilTypingRef.current

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

    const cachedImmediate = readSuggestCache(q)
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

      const cached = readSuggestCache(q)
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
          const list = await fetchSuggestions(q, ac.signal)
          if (runId !== generationRef.current) return
          writeSuggestCache(q, list)
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
  }, [value, minLength, debounceMs, disabled, invalidatePending])

  const hasResults = suggestions.length > 0
  const showListbox = panelOpen && hasResults

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
      onChange(item.label)
      onPickSuggestion(item)
      setOpen(false)
      setSuggestions([])
      setActiveIndex(-1)
    },
    [invalidatePending, onChange, onPickSuggestion],
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

  const panelWidth = dropdownRect ? Math.max(dropdownRect.width, 240) : 240
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
        role={hasResults ? "listbox" : undefined}
        aria-label={hasResults ? "Location suggestions" : undefined}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "fixed z-[100] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground",
          "shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95 duration-150",
        )}
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(55vh, 320px)",
        }}
      >
        {fetchEmpty ? (
          <div className="flex gap-3 p-4 text-sm text-muted-foreground">
            <MapPin className="h-5 w-5 shrink-0 text-muted-foreground/70 mt-0.5" aria-hidden />
            <div>
              <p className="font-medium text-foreground">No matches</p>
              <p className="mt-1 text-xs leading-relaxed">
                Try a US ZIP code, city name, or neighborhood — check spelling or add the state.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[min(55vh,320px)] flex-col">
            <div className="max-h-[min(48vh,268px)] overflow-y-auto overscroll-contain py-1">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s.lat}-${s.lng}-${s.label}`}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  id={`${listboxId}-opt-${idx}`}
                  className={cn(
                    "flex w-full min-h-touch cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-muted/70 active:bg-muted",
                    idx === activeIndex ? "bg-muted" : "",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    pick(s)
                  }}
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
                    <HighlightMatch text={s.label} query={qTrim} />
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-border/60 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">↑↓</span> move · <span className="tabular-nums">Enter</span> select ·{" "}
              <span className="tabular-nums">Esc</span> close
            </div>
          </div>
        )}
      </div>,
      document.body,
    )

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <Input
        ref={inputRef}
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
            const cached = readSuggestCache(q)
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
          panelOpen && "ring-2 ring-ring/35 ring-offset-2 ring-offset-background",
        )}
      />
      {dropdownPanel}
    </div>
  )
}
