"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Section = "all" | "used" | "boards"

interface SearchResultsBarProps {
  query: string
  section: Section
  usedCount: number
  boardsCount: number
}

const SECTION_OPTIONS: { value: Section; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "used", label: "Used gear" },
  { value: "boards", label: "Surfboards" },
]

export function SearchResultsBar({
  query,
  section,
  usedCount,
  boardsCount,
}: SearchResultsBarProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const q = (form.q?.value ?? "").trim()
    const sectionValue = (form.section?.value ?? "all") as Section
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (sectionValue !== "all") params.set("section", sectionValue)
    const search = params.toString()
    router.push(search ? `/search?${search}` : "/")
  }

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-border bg-background px-4 py-4">
      <div className="container mx-auto max-w-4xl">
        <form
          ref={formRef}
          key={`${query}-${section}`}
          onSubmit={handleApply}
          className="flex flex-wrap items-center gap-2 sm:gap-3"
        >
          <div className="relative flex min-w-0 flex-1 basis-40">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search listings..."
              className="h-10 rounded-md border-border bg-background pl-9 text-foreground"
              autoComplete="off"
            />
          </div>

          <div className="relative">
            <select
              name="section"
              defaultValue={section}
              className={cn(
                "h-10 w-[180px] shrink-0 appearance-none rounded-md border border-border bg-background pl-3 pr-9 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            >
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === "used" && usedCount > 0
                    ? `Used gear (${usedCount})`
                    : opt.value === "boards" && boardsCount > 0
                      ? `Surfboards (${boardsCount})`
                      : opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground pointer-events-none" />
          </div>

          <Button type="submit" className="h-10 shrink-0 rounded-md gap-2 px-4">
            <SlidersHorizontal className="h-4 w-4" />
            Apply
          </Button>
        </form>
      </div>
    </div>
  )
}
