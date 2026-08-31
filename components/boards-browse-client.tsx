"use client"

import { type ReactNode, Suspense, useCallback, useMemo, useRef, useState, useTransition } from "react"
import type { StaticImageData } from "next/image"
import { Check, Truck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { CategoryBrowsePageHeader } from "@/components/category-browse-page-header"
import { CategoryBrowseFilterButton } from "@/components/category-browse-filter-button"
import {
  BrowseFiltersHoverBar,
  browseFiltersHoverBarClearanceClassName,
  browseFiltersHoverBarPinnedClearanceClassName,
} from "@/components/features/browse/browse-filters-hover-bar"
import { BoardsBrowseFacetControls } from "@/components/boards-browse-facet-controls"
import { useBoardsFilterState } from "@/components/boards-browse-filter-state"
import { BoardsSaveSearchPanel } from "@/components/boards-save-search-panel"
import {
  BoardsGiveawayEnterControls,
  type BoardsGiveawayEnterProps,
} from "@/components/features/giveaways/boards-giveaway-enter-button"
import { ListYourSurfboardSellCta } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { facetOptionLabel, FACET_PARAM_KEYS } from "@/lib/boards-browse-facets"
import { logBrowseButtonClick } from "@/lib/log-browse-button-click"
import { cn } from "@/lib/utils"
import boardsBrowseAtmosphere from "@/public/images/brand/boards-browse-barrel.jpg"

type FacetCountsMap = Record<string, Record<string, number>>

type BoardsBrowseClientProps = {
  children: ReactNode
  counts: FacetCountsMap
  /** Page H1 — rendered with Filter in one header band. Omit when the page supplies its own heading. */
  title?: string
  description?: string
  /** Optional admin CMS control shown in the header action row. */
  headerAction?: ReactNode
  /** Wave photo behind the title. Defaults on when `title` is set. */
  atmosphere?: boolean
  /** Overrides the default boards atmosphere photo (e.g. city landings). */
  atmosphereImage?: StaticImageData | string
  atmosphereImageClassName?: string
  /** Rendered at the top of the results column (beside the filter sidebar). */
  afterHeader?: ReactNode
  showSaveSearch?: boolean
  /** Mobile hover-bar sell CTA — city landings only. */
  showHoverBarListBoard?: boolean
  /** City landings: hide location/radius — the page is already city-scoped. */
  showLocationFilter?: boolean
  /**
   * City infinite scroll: keep the floating Filters bar pinned on mobile and
   * desktop so Filters stays reachable without scrolling to the header.
   */
  persistFiltersHoverBar?: boolean
  /**
   * City landings: scroll the board grid (chips + listings) into view when a
   * filter changes, so users skip Top listings / shops / sellers strips.
   */
  scrollListingsIntoViewOnFilter?: boolean
  /** Open raffle CTA for the hero + mobile hover bar. */
  giveawayEnter?: BoardsGiveawayEnterProps | null
}

type ActiveChip = { id: string; label: string; onRemove: () => void }

function BoardsShipToMeButton({
  pressed,
  onToggle,
  className,
  label,
}: {
  pressed: boolean
  onToggle: () => void
  className?: string
  label: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={pressed}
      aria-label={
        pressed
          ? "Showing boards that ship — click to clear"
          : "Show only boards that ship to you"
      }
      onClick={onToggle}
      className={cn(
        "shrink-0 gap-2 rounded-full text-sm font-semibold shadow-none transition-colors",
        pressed
          ? "border-transparent bg-[#001A4A] text-white hover:bg-[#001A4A]/90"
          : "border-[#001A4A]/20 bg-[#E8EEF8] text-[#001A4A] hover:border-[#001A4A]/35 hover:bg-[#DCE6F5]",
        className,
      )}
    >
      {pressed ? (
        <Check className="h-4 w-4 shrink-0 stroke-[2.25]" aria-hidden="true" />
      ) : (
        <Truck className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden="true" />
      )}
      {label}
    </Button>
  )
}

export function BoardsBrowseClient({
  children,
  counts,
  title,
  description,
  headerAction,
  atmosphere,
  atmosphereImage,
  atmosphereImageClassName,
  afterHeader,
  showSaveSearch = true,
  showHoverBarListBoard = false,
  showLocationFilter = true,
  persistFiltersHoverBar = false,
  scrollListingsIntoViewOnFilter = false,
  giveawayEnter = null,
}: BoardsBrowseClientProps) {
  const [isPending, startTransition] = useTransition()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false)
  const dropoffSentinelRef = useRef<HTMLDivElement>(null)
  const listingsAnchorRef = useRef<HTMLDivElement>(null)

  const scrollListingsIntoView = useCallback(() => {
    if (!scrollListingsIntoViewOnFilter) return
    const node = listingsAnchorRef.current
    if (!node) return
    // Defer past layout from optimistic filter updates / mobile sheet.
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [scrollListingsIntoViewOnFilter])

  const state = useBoardsFilterState(startTransition, {
    onAfterNavigate: scrollListingsIntoViewOnFilter ? scrollListingsIntoView : undefined,
  })

  const chips = useMemo<ActiveChip[]>(() => {
    const out: ActiveChip[] = []
    const pushMulti = (paramKey: string, values: string[]) => {
      for (const v of values) {
        out.push({
          id: `${paramKey}:${v}`,
          label: facetOptionLabel(paramKey, v),
          onRemove: () => state.toggleMulti(paramKey, v),
        })
      }
    }
    pushMulti(FACET_PARAM_KEYS.style, state.selections.styles)
    pushMulti(FACET_PARAM_KEYS.length, state.selections.lengthBuckets)
    pushMulti(FACET_PARAM_KEYS.volume, state.selections.volumeBuckets)
    pushMulti(FACET_PARAM_KEYS.finSetup, state.selections.finSetups)
    pushMulti(FACET_PARAM_KEYS.finSystem, state.selections.finSystems)
    pushMulti(FACET_PARAM_KEYS.construction, state.selections.constructions)
    pushMulti(FACET_PARAM_KEYS.condition, state.selections.conditions)

    if (state.brand.trim() || state.brandId.trim()) {
      out.push({
        id: "brand",
        label: `Brand: ${state.brand || "selected"}`,
        onRemove: () => state.setBrand({ brand: "", brandId: "" }),
      })
    }
    if (state.model.trim() || state.brandModelId.trim()) {
      out.push({
        id: "model",
        label: `Model: ${state.model || "selected"}`,
        onRemove: () => state.setModel({ model: "", brandModelId: "" }),
      })
    }
    if (state.minPrice.trim() || state.maxPrice.trim()) {
      const lo = state.minPrice.trim() ? `$${state.minPrice}` : "$0"
      const hi = state.maxPrice.trim() ? `$${state.maxPrice}` : "Any"
      out.push({
        id: "price",
        label: `${lo} – ${hi}`,
        onRemove: () => state.setPriceRange(null, null),
      })
    }
    if (showLocationFilter && state.location.trim()) {
      out.push({
        id: "location",
        label: state.location.trim(),
        onRemove: () => state.setLocationQuery(""),
      })
    }
    if (showLocationFilter && state.radius !== "any") {
      out.push({
        id: "radius",
        label: `${state.radius} mi`,
        onRemove: () => state.setRadius(null),
      })
    }
    if (state.shippingAvailable) {
      out.push({
        id: "shipping",
        label: "Ship to me",
        onRemove: () => state.setShippingAvailable(false),
      })
    }
    return out
  }, [state, showLocationFilter])

  const locationActiveExtras = showLocationFilter
    ? 0
    : (state.location.trim() ? 1 : 0) + (state.radius !== "any" ? 1 : 0)
  const activeFilterCount = Math.max(0, state.activeCount - locationActiveExtras)
  const hasAnyActiveFilter =
    showLocationFilter
      ? state.hasAnyActive
      : activeFilterCount > 0

  const shell = (giveawayButtons: {
    desktopButton: ReactNode
    mobileButton: ReactNode
  } | null) => (
    <>
      <CategoryBrowsePageHeader
        title={title}
        description={description}
        atmosphereImage={
          atmosphereImage ??
          (title && atmosphere !== false ? boardsBrowseAtmosphere : undefined)
        }
        // Wave/barrel sits mid-frame — bias down from the sky-heavy top crop.
        atmosphereImageClassName={
          atmosphereImageClassName ?? "object-[38%_72%] md:object-[40%_60%]"
        }
        action={
          persistFiltersHoverBar ? (
            headerAction || giveawayButtons?.desktopButton ? (
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                {headerAction}
                {giveawayButtons?.desktopButton}
              </div>
            ) : null
          ) : (
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {headerAction}
              {giveawayButtons?.desktopButton}
              <BoardsShipToMeButton
                pressed={state.shippingAvailable}
                onToggle={() => {
                  const next = !state.shippingAvailable
                  logBrowseButtonClick({
                    category: "boards",
                    button: "ship_to_me",
                    detail: next ? "enabled" : "disabled",
                  })
                  state.setShippingAvailable(next)
                }}
                className="h-10 px-4"
                label="Ship to me"
              />
              <CategoryBrowseFilterButton
                category="boards"
                activeFilterCount={activeFilterCount}
                onOpenMobileFilters={() => setMobileOpen(true)}
                desktopFiltersOpen={desktopFiltersOpen}
                onToggleDesktopFilters={() => setDesktopFiltersOpen((open) => !open)}
              />
            </div>
          )
        }
      />

      <div
        className={cn(
          "mt-5 flex w-full min-w-0 gap-6",
          persistFiltersHoverBar
            ? browseFiltersHoverBarPinnedClearanceClassName
            : browseFiltersHoverBarClearanceClassName,
        )}
      >
        {/* Desktop: collapsible left sidebar (toggled by the toolbar Filters button) */}
        <aside className={cn("hidden w-[260px] shrink-0", desktopFiltersOpen && "md:block")}>
          <div
            className={cn(
              "sticky top-[calc(var(--site-header-height,4rem)+0.75rem)] flex flex-col",
              persistFiltersHoverBar
                ? "max-h-[calc(100dvh-var(--site-header-height,4rem)-1.5rem-5.25rem-env(safe-area-inset-bottom,0px))]"
                : "max-h-[calc(100dvh-var(--site-header-height,4rem)-1.5rem)]",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Filter
                </h2>
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] tabular-nums">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </div>
              {hasAnyActiveFilter ? (
                <button
                  type="button"
                  onClick={state.clearAll}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] pr-1">
              <BoardsBrowseFacetControls
                state={state}
                counts={counts}
                locationListboxId="boards-location-sidebar"
                showLocationFilter={showLocationFilter}
              />
              {showSaveSearch ? (
                <>
                  <Separator className="my-4" />
                  <Suspense fallback={null}>
                    <BoardsSaveSearchPanel />
                  </Suspense>
                </>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Results column — strips (top listings / shops / sellers) live here so
            opening the sidebar narrows them with the board grid. */}
        <div className="min-w-0 flex-1">
          {afterHeader}

          <div
            ref={scrollListingsIntoViewOnFilter ? listingsAnchorRef : undefined}
            id={scrollListingsIntoViewOnFilter ? "city-board-listings" : undefined}
            className={
              scrollListingsIntoViewOnFilter
                ? "scroll-mt-[calc(var(--site-header-height,4rem)+0.75rem)]"
                : undefined
            }
          >
            {chips.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm text-primary transition-colors hover:bg-primary/20"
                  >
                    {chip.label}
                    <X className="ml-0.5 h-3 w-3 shrink-0" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={state.clearAll}
                  className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
            ) : null}

            <div
              className={cn(
                "relative transition-[opacity] duration-300 ease-out motion-reduce:transition-none",
                isPending && "opacity-[0.97]",
              )}
              aria-busy={isPending}
            >
              {children}
              <div ref={dropoffSentinelRef} className="h-px w-full" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <BrowseFiltersHoverBar
        hidden={mobileOpen}
        label="Browse filters"
        dropoffSentinel={dropoffSentinelRef}
        persist={persistFiltersHoverBar}
      >
        {giveawayButtons?.mobileButton}
        <BoardsShipToMeButton
          pressed={state.shippingAvailable}
          onToggle={() => {
            const next = !state.shippingAvailable
            logBrowseButtonClick({
              category: "boards",
              button: "ship_to_me",
              detail: next ? "enabled" : "disabled",
            })
            state.setShippingAvailable(next)
          }}
          className="h-11 min-w-0 flex-1 gap-1.5 px-2.5 sm:flex-none sm:px-4"
          label={<span className="truncate">Ship</span>}
        />
        <CategoryBrowseFilterButton
          category="boards"
          activeFilterCount={activeFilterCount}
          onOpenMobileFilters={() => setMobileOpen(true)}
          desktopFiltersOpen={desktopFiltersOpen}
          onToggleDesktopFilters={() => setDesktopFiltersOpen((open) => !open)}
          className="min-w-0 flex-1 sm:flex-none"
          buttonClassName="h-11 w-full font-semibold px-2.5 sm:px-4"
        />
        {showHoverBarListBoard ? (
          <ListYourSurfboardSellCta
            showArrow={false}
            size="sm"
            className="h-11 min-w-0 flex-[1.35] rounded-full px-2.5 text-sm font-semibold sm:flex-none sm:px-4"
          >
            <span className="truncate">List your board</span>
          </ListYourSurfboardSellCta>
        ) : null}
      </BrowseFiltersHoverBar>

      {/* Mobile: full-screen filter drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-full md:hidden"
          onPointerDownOutside={(e) => {
            const t = e.target as HTMLElement | null
            // Location suggestions + Select menus portal outside the Sheet node; without this,
            // Radix treats taps as “outside” and dismisses before the pick can apply.
            if (
              t?.closest("[data-location-suggest]") ||
              t?.closest("[data-radix-popper-content-wrapper]")
            ) {
              e.preventDefault()
            }
          }}
          onFocusOutside={(e) => {
            const t = e.target as HTMLElement | null
            if (
              t?.closest("[data-location-suggest]") ||
              t?.closest("[data-radix-popper-content-wrapper]")
            ) {
              e.preventDefault()
            }
          }}
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement | null
            if (
              t?.closest("[data-location-suggest]") ||
              t?.closest("[data-radix-popper-content-wrapper]")
            ) {
              e.preventDefault()
            }
          }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3.5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-semibold text-foreground">Filters</SheetTitle>
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] tabular-nums">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 pb-4">
              <BoardsBrowseFacetControls
                state={state}
                counts={counts}
                locationListboxId="boards-location-drawer"
                showLocationFilter={showLocationFilter}
              />
              {showSaveSearch ? (
                <>
                  <Separator className="my-4" />
                  <Suspense fallback={null}>
                    <BoardsSaveSearchPanel />
                  </Suspense>
                </>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-3 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              disabled={!hasAnyActiveFilter}
              onClick={state.clearAll}
            >
              Clear all
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full"
              onClick={() => {
                setMobileOpen(false)
                scrollListingsIntoView()
              }}
            >
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )

  if (!giveawayEnter) {
    return shell(null)
  }

  return (
    <BoardsGiveawayEnterControls giveaway={giveawayEnter.giveaway}>
      {(buttons) => shell(buttons)}
    </BoardsGiveawayEnterControls>
  )
}
