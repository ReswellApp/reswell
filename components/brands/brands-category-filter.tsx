"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import {
  BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS,
  type BrandsDirectoryFilterCategorySlug,
  parseBrandsDirectoryFilterCategorySlugsFromSearchParam,
} from "@/lib/brand-product-categories"
import { cn } from "@/lib/utils"

export function BrandsCategoryFilter({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const selected = parseBrandsDirectoryFilterCategorySlugsFromSearchParam(
    searchParams.getAll("category"),
  )

  function toggleCategory(slug: BrandsDirectoryFilterCategorySlug) {
    const next = new Set(selected)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    const ordered = BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS.map((option) => option.slug).filter(
      (s) => next.has(s),
    )
    if (ordered.length > 0) params.set("category", ordered.join(","))

    const qs = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    })
  }

  function clearCategories() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    const qs = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    })
  }

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
          {compact ? "Product type" : "Filter by product type"}
        </p>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={clearCategories}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS.map((option) => {
          const active = selected.includes(option.slug)
          return (
            <button
              key={option.slug}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCategory(option.slug)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
                active
                  ? "border-[#355185] bg-[#355185] text-white"
                  : "border-transparent bg-white/80 text-foreground hover:bg-white",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
