"use client"

import { useState, type MouseEvent } from "react"
import { ChevronDown, MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BoardsBrowseLocationFilter } from "@/components/boards-browse-location-filter"
import type { BoardsFilterState } from "@/components/boards-browse-filter-state"
import { cn } from "@/lib/utils"

type Props = {
  state: BoardsFilterState
}

function locationButtonLabel(location: string, homePreference: boolean): string {
  const trimmed = location.trim()
  if (!trimmed) return "Location"
  const short = trimmed.split(",")[0]?.trim() || trimmed
  return homePreference ? `Near ${short}` : short
}

function isPortaledOverlayTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(
    el?.closest("[data-location-suggest]") ||
      el?.closest("[data-radix-select-content]") ||
      el?.closest("[data-radix-popper-content-wrapper]"),
  )
}

const locationControlClassName =
  "h-9 gap-1.5 rounded-none border-transparent bg-transparent px-3.5 text-sm font-semibold text-white shadow-none hover:bg-white/10 hover:text-white"

/** Compact /boards location control — sits under the hero, above the listing grid. */
export function BoardsBrowseLocationFilterButton({ state }: Props) {
  const [open, setOpen] = useState(false)
  const hasLocation = Boolean(state.location.trim())
  const label = locationButtonLabel(state.location, state.homePreference)

  function clearLocation(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    // Clears location, lat, lng, and radius in one URL update.
    state.setLocationQuery("")
    setOpen(false)
  }

  return (
    <div className="inline-flex min-w-0 max-w-full overflow-hidden rounded-full bg-[#001A4A]">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={hasLocation ? `Filter by location: ${label}` : "Filter by location"}
            aria-haspopup="dialog"
            className={cn(locationControlClassName, hasLocation ? "pr-2.5" : "pr-3.5")}
          >
            <MapPin className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden="true" />
            <span className="max-w-[9.5rem] truncate sm:max-w-[14rem]">{label}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 stroke-[2.25] opacity-90 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          className="w-[min(100vw-1.5rem,20rem)] p-3"
          onPointerDownOutside={(event) => {
            if (isPortaledOverlayTarget(event.target)) event.preventDefault()
          }}
          onFocusOutside={(event) => {
            if (isPortaledOverlayTarget(event.target)) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (isPortaledOverlayTarget(event.target)) event.preventDefault()
          }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Location
          </p>
          <BoardsBrowseLocationFilter state={state} listboxId="boards-location-toolbar" />
        </PopoverContent>
      </Popover>
      {hasLocation ? (
        <Button
          type="button"
          variant="outline"
          aria-label="Clear location filter"
          title="Clear location"
          onClick={clearLocation}
          className={cn(locationControlClassName, "border-l border-white/25 px-2.5")}
        >
          <X className="h-3.5 w-3.5 stroke-[2.25]" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
