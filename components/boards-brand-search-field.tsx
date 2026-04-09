"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type BoardsBrandSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  listboxId?: string
  inputClassName?: string
  className?: string
}

const BROWSE_CAP = 40

/**
 * Surfboards browse filter: typeahead over `public.brands.name` only (same data as
 * `BrandInputWithSuggestions` on /sell — no marketplace listing suggest, no thumbnails).
 */
export function BoardsBrandSearchField({
  value,
  onChange,
  name = "q",
  placeholder = "Filter by brand name…",
  listboxId = "boards-brand-q-list",
  inputClassName = "",
  className = "",
}: BoardsBrandSearchFieldProps) {
  const [brandNames, setBrandNames] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase.from("brands").select("name").order("name", { ascending: true })
      if (cancelled || error) return
      const seen = new Set<string>()
      const names: string[] = []
      for (const row of data ?? []) {
        const n = typeof row.name === "string" ? row.name.trim() : ""
        if (!n || seen.has(n.toLowerCase())) continue
        seen.add(n.toLowerCase())
        names.push(n)
      }
      names.sort((a, b) => a.localeCompare(b))
      setBrandNames(names)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const q = value.trim().toLowerCase()
  const displayed = React.useMemo(() => {
    if (!q) return brandNames.slice(0, BROWSE_CAP)
    return brandNames.filter((n) => n.toLowerCase().includes(q)).slice(0, BROWSE_CAP)
  }, [brandNames, value])

  const showNoMatch = open && q.length > 0 && brandNames.length > 0 && displayed.length === 0
  const showDropdown = open && brandNames.length > 0 && (displayed.length > 0 || showNoMatch)

  React.useEffect(() => {
    setHighlight(0)
  }, [value, displayed.length])

  React.useEffect(() => {
    if (!showDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showDropdown])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 280), 440)
    : 360
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role="listbox"
        className="fixed z-[100] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(320px, 50vh)",
        }}
      >
        <p className="border-b border-border/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Brands
        </p>
        {showNoMatch ? (
          <div className="px-3 py-2.5 text-sm text-muted-foreground">
            No brand name matches &quot;{value.trim()}&quot;. You can still search listings with your own words.
          </div>
        ) : (
          <ul className="max-h-[min(280px,45vh)] overflow-y-auto py-1">
            {displayed.map((label, i) => (
              <li key={label} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex w-full cursor-pointer select-none items-center px-3 py-2.5 text-left text-sm outline-none min-h-touch",
                    i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    onChange(label)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>,
      document.body,
    )

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      <Input
        type="search"
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        autoComplete="off"
        className={inputClassName}
        onKeyDown={(e) => {
          if (showNoMatch) {
            if (e.key === "Escape") {
              e.preventDefault()
              setOpen(false)
            }
            return
          }
          if (!showDropdown || displayed.length === 0) {
            if (e.key === "Escape") setOpen(false)
            return
          }
          if (e.key === "Escape") {
            e.preventDefault()
            setOpen(false)
            return
          }
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, displayed.length - 1))
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
            return
          }
          if (e.key === "Enter") {
            e.preventDefault()
            const row = displayed[highlight]
            if (row) {
              onChange(row)
              setOpen(false)
            }
          }
        }}
      />
      {dropdownPanel}
    </div>
  )
}
