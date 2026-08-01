"use client"

import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Props = {
  activeFilterCount: number
  onOpenMobileFilters: () => void
  desktopFiltersOpen?: boolean
  onToggleDesktopFilters?: () => void
  className?: string
}

/** Compact Filter control shared by category browse page headers. */
export function CategoryBrowseFilterButton({
  activeFilterCount,
  onOpenMobileFilters,
  desktopFiltersOpen = false,
  onToggleDesktopFilters,
  className,
}: Props) {
  const badge =
    activeFilterCount > 0 ? (
      <Badge
        variant="secondary"
        className="h-5 rounded-full bg-[#5574AD]/15 px-1.5 text-[11px] tabular-nums text-[#163060]"
      >
        {activeFilterCount}
      </Badge>
    ) : null

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0 gap-2 rounded-full border-[#001A4A]/15 bg-white px-4 text-sm font-medium text-[#001A4A] shadow-none hover:bg-[#F9F9F2] md:hidden"
        onClick={onOpenMobileFilters}
      >
        <SlidersHorizontal className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
        Filter
        {badge}
      </Button>

      <Button
        type="button"
        variant="outline"
        aria-expanded={desktopFiltersOpen}
        aria-label={desktopFiltersOpen ? "Hide filters" : "Show filters"}
        onClick={onToggleDesktopFilters}
        className="hidden h-10 shrink-0 gap-2 rounded-full border-[#001A4A]/15 bg-white px-4 text-sm font-medium text-[#001A4A] shadow-none hover:bg-[#F9F9F2] md:inline-flex"
      >
        <SlidersHorizontal className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
        Filter
        {badge}
      </Button>
    </div>
  )
}
