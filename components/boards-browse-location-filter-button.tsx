"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BoardsBrowseLocationFilter } from "@/components/boards-browse-location-filter"
import type { BoardsFilterState } from "@/components/boards-browse-filter-state"
import { boardsBrowseLocationButtonLabel } from "@/lib/utils/boards-browse-location-label"
import { cn } from "@/lib/utils"

type Props = {
  state: BoardsFilterState
}

function isPortaledOverlayTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(
    el?.closest("[data-location-suggest]") ||
      el?.closest("[data-radix-select-content]") ||
      el?.closest("[data-radix-popper-content-wrapper]"),
  )
}

/** Marketplace-style location control: blue pin + "City, ST" above the listing grid. */
export function BoardsBrowseLocationFilterButton({ state }: Props) {
  const [open, setOpen] = useState(false)
  const hasLocation = Boolean(state.location.trim())
  const label = boardsBrowseLocationButtonLabel(state.location)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={hasLocation ? `Filter by location: ${label}` : "Filter by location"}
          aria-haspopup="dialog"
          className={cn(
            "h-auto min-w-0 max-w-full gap-1 rounded-none px-0 py-0.5 text-[15px] font-semibold",
            "text-[#1877F2] shadow-none hover:bg-transparent hover:text-[#166FE5]",
            "md:text-base",
          )}
        >
          <MapPin
            className="h-[18px] w-[18px] shrink-0 fill-current stroke-current"
            aria-hidden="true"
          />
          <span className="max-w-[11rem] truncate sm:max-w-[16rem]">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Location filter"
        className="w-[min(100vw-1.5rem,21rem)] rounded-2xl border-neutral-200/90 p-3 shadow-lg"
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
        <BoardsBrowseLocationFilter
          state={state}
          listboxId="boards-location-toolbar"
          layout="toolbar"
        />
      </PopoverContent>
    </Popover>
  )
}
