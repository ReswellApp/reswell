"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { curatedRecentSearchHref } from "@/lib/nav-curated-search"

export type MarketplaceCategoryRow = {
  id: string
  name: string
  slug: string
  board?: boolean | null
  gear?: boolean | null
}

interface SearchCategoryFiltersProps {
  query: string
  /** `null` = default (all board listings — surfboards section). */
  selectedSlug: string | null
  categories: MarketplaceCategoryRow[]
  /** True when showing curated recents (no keyword search). */
  curated?: boolean
}

/** Marketplace search filter: `public.categories` rows with `board` or `gear` set. Default = all board listings. */
export function SearchCategoryFilters({
  query,
  selectedSlug,
  categories,
  curated = false,
}: SearchCategoryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const slug = (form.elements.namedItem("category") as HTMLSelectElement)?.value?.trim() ?? ""
    const q = (searchParams.get("q") ?? query).trim()
    if (q) {
      const params = new URLSearchParams()
      params.set("q", q)
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
    <div className="border-b border-border bg-muted/20 py-3">
      <div className="container mx-auto flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {query ? (
            <>
              Filtering results for <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
              <span className="hidden sm:inline"> — change keywords in the search bar above</span>
            </>
          ) : curated ? (
            "Curated recents — pick a category below, or search from the header."
          ) : (
            "Browse active listings — use the search bar to narrow results."
          )}
        </p>
        <form
          ref={formRef}
          key={selectedSlug ?? ""}
          onSubmit={handleApply}
          className="ml-auto flex flex-wrap items-center gap-2"
        >
          <div className="relative">
            <select
              name="category"
              defaultValue={selectedSlug ?? ""}
              className={cn(
                "h-9 min-w-[200px] appearance-none rounded-md border border-border bg-background pl-3 pr-8 text-sm",
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
          <Button type="submit" size="sm" className="gap-1.5 rounded-md">
            <SlidersHorizontal className="h-4 w-4" />
            Apply
          </Button>
        </form>
      </div>
    </div>
  )
}
