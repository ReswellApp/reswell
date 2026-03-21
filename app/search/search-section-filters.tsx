"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Section = "all" | "used" | "boards"

interface SearchSectionFiltersProps {
  query: string
  section: Section
  usedCount: number
  boardsCount: number
  /** True when showing curated recents (no keyword search). */
  curated?: boolean
}

const SECTION_OPTIONS: { value: Section; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "used", label: "Used gear" },
  { value: "boards", label: "Surfboards" },
]

/** Section filter only — search text lives in the main nav bar. */
export function SearchSectionFilters({
  query,
  section,
  usedCount,
  boardsCount,
  curated = false,
}: SearchSectionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const sectionValue = (form.section?.value ?? "all") as Section
    const params = new URLSearchParams()
    const q = (searchParams.get("q") ?? query).trim()
    if (q) {
      params.set("q", q)
    } else {
      params.set("view", "recent")
    }
    if (sectionValue !== "all") params.set("section", sectionValue)
    router.push(`/search?${params.toString()}`)
  }

  const getSectionLabel = (opt: (typeof SECTION_OPTIONS)[0]) => {
    if (opt.value === "used" && usedCount > 0) return `Used gear (${usedCount})`
    if (opt.value === "boards" && boardsCount > 0) return `Surfboards (${boardsCount})`
    return opt.label
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
            "Curated recents — filter by used gear or surfboards below, or search from the header."
          ) : (
            "Browse active listings — use the search bar to narrow results."
          )}
        </p>
        <form
          ref={formRef}
          key={section}
          onSubmit={handleApply}
          className="ml-auto flex flex-wrap items-center gap-2"
        >
          <div className="relative">
            <select
              name="section"
              defaultValue={section}
              className={cn(
                "h-9 min-w-[160px] appearance-none rounded-md border border-border bg-background pl-3 pr-8 text-sm",
              )}
            >
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {getSectionLabel(opt)}
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
