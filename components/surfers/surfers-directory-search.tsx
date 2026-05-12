"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import type { SurferRow } from "@/lib/surfers/types"
import { SURFERS_BASE } from "@/lib/surfers/routes"

const BROWSE_LIMIT = 36

function browseSurfers(surfers: SurferRow[]): SurferRow[] {
  return [...surfers].sort((a, b) => a.name.localeCompare(b.name)).slice(0, BROWSE_LIMIT)
}

function filterSurfers(surfers: SurferRow[], q: string): SurferRow[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  return surfers.filter((s) => {
    const name = s.name.toLowerCase()
    const loc = (s.location_label ?? "").toLowerCase()
    return name.includes(t) || loc.includes(t)
  })
}

type SurfersDirectorySearchProps = {
  surfers: SurferRow[]
  className?: string
}

export function SurfersDirectorySearch({ surfers, className }: SurfersDirectorySearchProps) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const q = value.trim()
  const browseList = React.useMemo(() => browseSurfers(surfers), [surfers])
  const filteredList = React.useMemo(() => filterSurfers(surfers, q), [surfers, q])
  const showBrowse = !q

  const activeList = showBrowse ? browseList : filteredList
  const listLength = activeList.length
  const showNoMatch = open && q.length > 0 && surfers.length > 0 && filteredList.length === 0
  const showDropdown = open && surfers.length > 0 && (showBrowse ? browseList.length > 0 : showNoMatch || filteredList.length > 0)

  React.useEffect(() => {
    setHighlight(0)
  }, [value, showBrowse, listLength])

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

  function goToSurfer(slug: string) {
    router.push(`${SURFERS_BASE}/${encodeURIComponent(slug)}`)
    setOpen(false)
    setValue("")
  }

  function searchMarketplaceForQuery(query: string) {
    const t = query.trim()
    if (!t) return
    router.push(`/search?q=${encodeURIComponent(t)}`)
    setOpen(false)
    setValue("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    searchMarketplaceForQuery(value)
  }

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 320), 480)
    : 360
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  const highlightMax = Math.max(0, activeList.length - 1)

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listId}
        role="listbox"
        aria-label="Surfer directory matches"
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(55vh, 420px)",
        }}
      >
        <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Surfers</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose a row for a profile, or press Search for listings
          </p>
        </div>
        {showNoMatch ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              No profile in this directory for &quot;{q}&quot;. You can still search the marketplace for that name.
            </p>
            <button
              type="button"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 min-h-touch"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => searchMarketplaceForQuery(value)}
            >
              Search listings for &quot;{q}&quot;
            </button>
          </div>
        ) : (
          <ul className="max-h-[min(45vh,340px)] overflow-y-auto py-1">
            {activeList.map((s, i) => (
              <li key={s.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                    i === highlight && "bg-muted/80",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    goToSurfer(s.slug)
                  }}
                >
                  {s.photo_url ? (
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-background">
                      <Image
                        src={s.photo_url}
                        alt=""
                        fill
                        className="object-cover object-center"
                        sizes="120px"
                        quality={88}
                      />
                    </span>
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-sm font-semibold text-cerulean"
                      aria-hidden
                    >
                      {s.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{s.name}</span>
                  {s.location_label ? (
                    <span className="hidden max-w-[38%] shrink-0 truncate text-xs text-muted-foreground sm:inline">
                      {s.location_label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>,
      document.body,
    )

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <p className="mb-2 text-center text-sm font-medium text-foreground">Search the surfer directory</p>
      <div ref={containerRef}>
        <form onSubmit={handleSubmit}>
          <SiteSearchShell
            actionSlot={
              <SiteSearchFormSubmitButton type="submit" aria-label="Open surfer profile or search marketplace">
                Search
              </SiteSearchFormSubmitButton>
            }
          >
            <Input
              type="search"
              name="surfer-directory-q"
              enterKeyHint="search"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search surfers or type any name…"
              aria-label="Surfer directory or freeform marketplace search"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? listId : undefined}
              autoComplete="off"
              className={siteSearchInputClassName()}
              onKeyDown={(e) => {
                if (showNoMatch) {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setOpen(false)
                  }
                  return
                }
                if (!showDropdown) {
                  if (e.key === "Escape") setOpen(false)
                  return
                }
                if (activeList.length === 0) {
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
                  setHighlight((h) => Math.min(h + 1, highlightMax))
                  return
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setHighlight((h) => Math.max(h - 1, 0))
                  return
                }
                if (e.key === "Enter") {
                  if (open && !showNoMatch && q.length > 0 && highlightMax >= 0) {
                    e.preventDefault()
                    const row = activeList[highlight]
                    if (row) goToSurfer(row.slug)
                  }
                }
              }}
            />
          </SiteSearchShell>
        </form>
      </div>
      {dropdownPanel}
    </div>
  )
}
