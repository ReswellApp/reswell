"use client"

import { localPagerPageNumbers, localPagerRangeLabel } from "@/lib/brands/local-pager"
import { cn } from "@/lib/utils"

const navButtonClass =
  "text-sm font-medium text-foreground transition-colors hover:text-[#355185] disabled:pointer-events-none disabled:opacity-30"

export function BrandsLocalPager({
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  className,
  label = "Pagination",
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** When set with totalItems, shows “Showing 1–12 of 111”. */
  pageSize?: number
  totalItems?: number
  className?: string
  label?: string
}) {
  if (totalPages <= 1 && (totalItems == null || totalItems <= 0)) return null

  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))
  const pages = localPagerPageNumbers(safePage, totalPages)
  const canGoBack = safePage > 1
  const canGoNext = safePage < totalPages
  const rangeLabel =
    pageSize != null && totalItems != null && totalItems > 0
      ? localPagerRangeLabel(safePage, pageSize, totalItems)
      : null

  if (totalPages <= 1) {
    return rangeLabel ? (
      <p className={cn("pt-6 text-center text-xs tabular-nums text-muted-foreground sm:text-sm", className)}>
        {rangeLabel}
      </p>
    ) : null
  }

  return (
    <div className={cn("pt-6 sm:pt-8", className)}>
      {rangeLabel ? (
        <p className="mb-4 text-center text-xs tabular-nums text-muted-foreground sm:text-sm" aria-live="polite">
          {rangeLabel}
        </p>
      ) : null}
      <nav className="flex flex-wrap items-center justify-center gap-5 sm:gap-6" aria-label={label}>
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onPageChange(safePage - 1)}
          className={navButtonClass}
        >
          Back
        </button>
        {pages.map((n) => {
          const active = n === safePage
          return (
            <button
              key={n}
              type="button"
              aria-label={`Page ${n}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onPageChange(n)}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center text-sm font-medium transition-all duration-300 ease-out",
                active
                  ? "rounded-full bg-[#355185] text-white shadow-sm"
                  : "rounded-full text-foreground hover:bg-[#E8EEF6] hover:text-[#355185]",
              )}
            >
              {n}
            </button>
          )
        })}
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => onPageChange(safePage + 1)}
          className={navButtonClass}
        >
          Next
        </button>
      </nav>
    </div>
  )
}
