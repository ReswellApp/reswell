"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Tag, Package, Type } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SuggestResult {
  titles: string[]
  categories: string[]
  brands: string[]
}

interface SearchInputWithSuggestProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  placeholder?: string
  /** "used" | "surfboards" to scope suggestions */
  section?: string
  className?: string
  inputClassName?: string
  /** Min length before fetching suggestions (default 2) */
  minLength?: number
  /** Debounce ms (default 200) */
  debounceMs?: number
  /** Optional id for the listbox (for a11y) */
  listboxId?: string
  /** Show type labels (category/brand/title) in dropdown */
  showTypeLabels?: boolean
  /** Optional icon to render left of input (e.g. Search icon) */
  leftIcon?: React.ReactNode
  /** Input name for forms */
  name?: string
  /** Disable autocomplete dropdown */
  disableSuggest?: boolean
  autoFocus?: boolean
}

export function SearchInputWithSuggest({
  value,
  onChange,
  onSelect,
  placeholder = "Search...",
  section = "",
  className = "",
  inputClassName = "",
  minLength = 2,
  debounceMs = 200,
  listboxId = "search-suggestions",
  showTypeLabels = true,
  leftIcon,
  name,
  disableSuggest = false,
  autoFocus = false,
}: SearchInputWithSuggestProps) {
  const [suggestions, setSuggestions] = useState<SuggestResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (disableSuggest) return
    const q = value.trim()
    if (q.length < minLength) {
      setSuggestions(null)
      setOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (section) params.set("section", section)
        const res = await fetch(`/api/search/suggest?${params.toString()}`)
        const data: SuggestResult = await res.json()
        const hasAny =
          (data.titles?.length ?? 0) > 0 ||
          (data.categories?.length ?? 0) > 0 ||
          (data.brands?.length ?? 0) > 0
        setSuggestions(hasAny ? data : null)
        setOpen(hasAny)
      } finally {
        setLoading(false)
      }
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, section, minLength, debounceMs, disableSuggest])

  const flatSuggestions = [
    ...(suggestions?.categories?.map((c) => ({ type: "category" as const, text: c })) ?? []),
    ...(suggestions?.brands?.map((b) => ({ type: "brand" as const, text: b })) ?? []),
    ...(suggestions?.titles?.map((t) => ({ type: "title" as const, text: t })) ?? []),
  ].slice(0, 12)

  const hasSuggestions = open && flatSuggestions.length > 0 && !disableSuggest

  // Position dropdown when open (for portal)
  useEffect(() => {
    if (!hasSuggestions || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 6, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [hasSuggestions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const handleSelect = (text: string) => {
    onChange(text)
    onSelect?.(text)
    setOpen(false)
    setSuggestions(null)
  }

  const dropdownList = hasSuggestions && dropdownRect && typeof document !== "undefined" && (
    <ul
      ref={dropdownRef}
      id={listboxId}
      role="listbox"
      className={cn(
        "fixed z-[100] overflow-auto rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg shadow-black/5",
        "max-h-[280px] py-1 min-w-[200px]",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
      )}
      style={{
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: Math.max(dropdownRect.width, 200),
      }}
    >
      {flatSuggestions.map((item, i) => {
        const Icon = item.type === "category" ? Tag : item.type === "brand" ? Package : Type
        return (
          <li
            key={`${item.type}-${item.text}-${i}`}
            role="option"
            tabIndex={0}
            className={cn(
              "mx-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors",
              "hover:bg-muted/80 focus:bg-muted/80",
              i === 0 && "mt-0.5",
              i === flatSuggestions.length - 1 && "mb-0.5"
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect(item.text)
            }}
          >
            {showTypeLabels ? (
              <>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.type}
                </span>
                <span className="min-w-0 truncate font-medium text-foreground">{item.text}</span>
              </>
            ) : (
              item.text
            )}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-muted-foreground">
          {leftIcon}
        </div>
      )}
      <Input
        type="search"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions && flatSuggestions.length > 0 && !disableSuggest && setOpen(true)}
        className={leftIcon ? `pl-10 ${inputClassName}` : inputClassName}
        autoComplete="off"
        aria-expanded={hasSuggestions}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={undefined}
        autoFocus={autoFocus}
      />
      {dropdownList && createPortal(dropdownList, document.body)}
      {loading && value.trim().length >= minLength && !disableSuggest && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          …
        </span>
      )}
    </div>
  )
}
