"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import {
  BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS,
  type BrandsDirectoryFilterCategorySlug,
  parseBrandsDirectoryFilterCategorySlugsFromSearchParam,
} from "@/lib/brand-product-categories"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const ALL_VALUE = "all"

export function BrandsCategoryFilter({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const selected = parseBrandsDirectoryFilterCategorySlugsFromSearchParam(
    searchParams.getAll("category"),
  )
  // Dropdown is single-select; keep the first active category if several were set.
  const value = selected[0] ?? ALL_VALUE

  function setCategory(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    if (next !== ALL_VALUE) {
      const slug = next as BrandsDirectoryFilterCategorySlug
      if (BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS.some((option) => option.slug === slug)) {
        params.set("category", slug)
      }
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    })
  }

  return (
    <div className={cn("w-full sm:w-56", className)}>
      <p className="mb-2 text-sm font-medium text-foreground">Product type</p>
      <Select value={value} onValueChange={setCategory}>
        <SelectTrigger
          aria-label="Filter brands by product type"
          className="h-12 w-full rounded-2xl border-border/80 bg-white px-4 text-sm font-medium shadow-sm sm:h-[3.25rem]"
        >
          <SelectValue placeholder="All product types" />
        </SelectTrigger>
        <SelectContent align="end" className="rounded-xl">
          <SelectItem value={ALL_VALUE}>All product types</SelectItem>
          {BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.slug} value={option.slug}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
