"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { curatedRecentSearchHref } from "@/lib/nav-curated-search"

export type MarketplaceCategoryRow = {
  id: string
  name: string
  slug: string
  board?: boolean | null
}

interface SearchCategoryFiltersProps {
  query: string
  /** `null` = default (all board listings — surfboards section). */
  selectedSlug: string | null
  categories: MarketplaceCategoryRow[]
  /** Active directory brand slug (`?brandSlug=`), if any. */
  brandSlug?: string | null
}

/** Marketplace search filter: `public.categories` rows with `board` set (surfboard types). */
export function SearchCategoryFilters({
  query,
  selectedSlug,
  categories,
  brandSlug = null,
}: SearchCategoryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const applyCategory = (slug: string) => {
    const q = (searchParams.get("q") ?? query).trim()
    const brandFromUrl = searchParams.get("brandSlug")?.trim() ?? ""
    const effectiveBrand = brandFromUrl || (brandSlug ?? "").trim()

    if (q) {
      const params = new URLSearchParams()
      params.set("q", q)
      if (slug) params.set("category", slug)
      if (effectiveBrand) params.set("brandSlug", effectiveBrand)
      router.push(`/search?${params.toString()}`)
      return
    }
    if (effectiveBrand) {
      const params = new URLSearchParams()
      params.set("brandSlug", effectiveBrand)
      if (slug) params.set("category", slug)
      router.push(`/search?${params.toString()}`)
      return
    }
    const base = curatedRecentSearchHref("")
    if (!slug) {
      router.push(base)
    } else {
      router.push(`${base}?category=${encodeURIComponent(slug)}`)
    }
  }

  return (
    <div className="relative shrink-0 sm:ml-auto">
      <label htmlFor="search-category" className="sr-only">
        Category
      </label>
      <select
        id="search-category"
        key={`${selectedSlug ?? ""}:${brandSlug ?? ""}`}
        name="category"
        defaultValue={selectedSlug ?? ""}
        onChange={(e) => applyCategory(e.target.value)}
        className={cn(
          "h-9 min-w-[11.5rem] appearance-none rounded-md border border-border bg-background pl-3 pr-8 text-sm",
        )}
      >
        <option value="">All board listings</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
