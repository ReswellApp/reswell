"use client"

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react"
import { MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { BoardsBrowseLocationFilter } from "@/components/boards-browse-location-filter"
import type { BoardsFilterState } from "@/components/boards-browse-filter-state"
import { boardsBrowseLocationButtonLabel } from "@/lib/utils/boards-browse-location-label"
import { useIsMobile } from "@/hooks/use-mobile"
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

const LocationTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    hasLocation: boolean
    label: string
    className?: string
  } & ComponentPropsWithoutRef<"button">
>(function LocationTriggerButton({ hasLocation, label, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      aria-label={hasLocation ? `Filter by location: ${label}` : "Filter by location"}
      aria-haspopup="dialog"
      className={cn(
        "h-auto min-w-0 max-w-full gap-1 rounded-none px-0 py-0.5 text-[15px] font-semibold",
        "text-[#1877F2] shadow-none hover:bg-transparent hover:text-[#166FE5]",
        "md:text-base",
        className,
      )}
      {...props}
    >
      <MapPin
        className="h-[18px] w-[18px] shrink-0 fill-current stroke-current"
        aria-hidden="true"
      />
      <span className="max-w-[11rem] truncate sm:max-w-[16rem]">{label}</span>
    </Button>
  )
})

/** Marketplace-style location control: blue pin + "City, ST" above the listing grid. */
export function BoardsBrowseLocationFilterButton({ state }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const hasLocation = Boolean(state.location.trim())
  const label = boardsBrowseLocationButtonLabel(state.location)

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        shouldScaleBackground={false}
        // Keep the sheet pinned while the soft keyboard opens — default vaul
        // input repositioning makes the search field jump on iOS/Android.
        repositionInputs={false}
      >
        <LocationTriggerButton
          hasLocation={hasLocation}
          label={label}
          onClick={() => setOpen(true)}
        />
        <DrawerContent
          showHandle
          className="flex max-h-[min(92dvh,40rem)] flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
        >
          <DrawerHeader className="flex shrink-0 flex-row items-start justify-between gap-3 border-b border-neutral-200/80 px-4 pb-3 pt-1 text-left">
            <div className="min-w-0 space-y-1 pr-2">
              <DrawerTitle className="text-base font-semibold text-foreground">
                Location
              </DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                Search a city or ZIP, then set how far to look.
              </DrawerDescription>
            </div>
            <DrawerClose
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Close location filter"
            >
              <X className="h-4 w-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
            <BoardsBrowseLocationFilter
              state={state}
              listboxId="boards-location-toolbar-mobile"
              layout="toolbar"
              panelPlacement="inline"
              autoFocus
            />
          </div>

          <div className="shrink-0 border-t border-neutral-200/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="h-11 w-full rounded-full text-[15px] font-semibold"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <LocationTriggerButton hasLocation={hasLocation} label={label} />
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
