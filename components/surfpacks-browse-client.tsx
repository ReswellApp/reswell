"use client"

import { type ReactNode, useMemo, useState, useTransition } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CategoryBrowsePageHeader } from "@/components/category-browse-page-header"
import { CategoryBrowseFilterButton } from "@/components/category-browse-filter-button"
import { SurfpacksBrowseFacetControls } from "@/components/surfpacks-browse-facet-controls"
import { useSurfpacksFilterState } from "@/components/surfpacks-browse-filter-state"
import { SURFPACK_FACET_PARAM_KEYS, surfpackFacetOptionLabel } from "@/lib/surfpacks-browse-facets"
import { cn } from "@/lib/utils"

type ActiveChip = { id: string; label: string; onRemove: () => void }

export function SurfpacksBrowseClient({
  children,
  title,
  description,
}: {
  children: ReactNode
  title?: string
  description?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false)
  const state = useSurfpacksFilterState(startTransition)

  const chips = useMemo<ActiveChip[]>(() => {
    const out: ActiveChip[] = []
    const pushMulti = (paramKey: string, values: string[]) => {
      for (const v of values) {
        out.push({
          id: `${paramKey}:${v}`,
          label: surfpackFacetOptionLabel(paramKey, v),
          onRemove: () => state.toggleMulti(paramKey, v),
        })
      }
    }
    pushMulti(SURFPACK_FACET_PARAM_KEYS.size, state.selections.sizes)
    pushMulti(SURFPACK_FACET_PARAM_KEYS.condition, state.selections.conditions)

    if (state.brand.trim()) {
      out.push({
        id: "brand",
        label: `Brand: ${state.brand}`,
        onRemove: () => state.setBrand(""),
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
    return out
  }, [state])

  return (
    <>
      <CategoryBrowsePageHeader
        title={title}
        description={description}
        action={
          <CategoryBrowseFilterButton
            category="surfpacks"
            activeFilterCount={state.activeCount}
            onOpenMobileFilters={() => setMobileOpen(true)}
            desktopFiltersOpen={desktopFiltersOpen}
            onToggleDesktopFilters={() => setDesktopFiltersOpen((open) => !open)}
          />
        }
      />

      <div className="mt-5 flex w-full min-w-0 gap-6">
        <aside className={cn("hidden w-[260px] shrink-0", desktopFiltersOpen && "md:block")}>
          <div className="sticky top-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Filter
                </h2>
                {state.activeCount > 0 ? (
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] tabular-nums">
                    {state.activeCount}
                  </Badge>
                ) : null}
              </div>
              {state.hasAnyActive ? (
                <button
                  type="button"
                  onClick={state.clearAll}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <SurfpacksBrowseFacetControls state={state} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
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
          </div>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-full md:hidden"
        >
          <div className="flex items-center justify-between border-b px-4 py-3.5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-semibold text-foreground">Filters</SheetTitle>
              {state.activeCount > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] tabular-nums">
                  {state.activeCount}
                </Badge>
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 pb-4">
              <SurfpacksBrowseFacetControls state={state} />
            </div>
          </ScrollArea>

          <div className="flex items-center gap-3 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              disabled={!state.hasAnyActive}
              onClick={state.clearAll}
            >
              Clear all
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full"
              onClick={() => setMobileOpen(false)}
            >
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
