"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"

export const usedConditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

interface UsedListingsFiltersProps {
  categoryOptions: { value: string; label: string }[]
  initialQ?: string
  initialCategory?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function UsedListingsFilters({
  categoryOptions,
  initialQ = "",
  initialCategory = "all",
  initialCondition = "all",
}: UsedListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [category, setCategory] = useState(initialCategory)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, category, condition })
  stateRef.current = { q, category, condition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setCategory(initialCategory)
    setCondition(initialCondition)
  }, [initialQ, initialCategory, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.category && f.category !== "all") params.set("category", f.category)
      if (f.condition && f.condition !== "all") params.set("condition", f.condition)
      params.set("page", "1")
      startTransition(() => {
        router.replace(
          `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
          { scroll: false },
        )
      })
    },
    [pathname, router, startTransition],
  )

  // Debounced text search
  useEffect(() => {
    if (skipQ.current) { skipQ.current = false; return }
    const t = setTimeout(() => pushFilters(), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, pushFilters])

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); pushFilters() }}
      className="grid grid-cols-2 gap-2 items-end md:flex md:flex-nowrap md:gap-2 md:items-end md:justify-center w-full max-w-4xl mx-auto"
    >
      <div className="col-span-2 w-full min-w-0 md:col-auto md:shrink-0 md:w-[400px] md:min-w-[400px]">
        <SearchInputWithSuggest
          value={q}
          onChange={setQ}
          placeholder="Search listings..."
          section="used"
          leftIcon={<Search className="h-4 w-4" />}
          name="q"
          listboxId="used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="category"
          value={category}
          onValueChange={(v) => { setCategory(v); pushFilters({ category: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="condition"
          value={condition}
          onValueChange={(v) => { setCondition(v); pushFilters({ condition: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any Condition" />
          </SelectTrigger>
          <SelectContent>
            {usedConditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>
                {cond.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
