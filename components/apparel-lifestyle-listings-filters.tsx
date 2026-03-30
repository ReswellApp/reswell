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
import { APPAREL_KIND_OPTIONS, APPAREL_SIZE_OPTIONS } from "@/lib/apparel-lifestyle-options"

export const apparelConditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

interface ApparelLifestyleListingsFiltersProps {
  initialQ?: string
  initialApparel?: string
  initialSize?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function ApparelLifestyleListingsFilters({
  initialQ = "",
  initialApparel = "all",
  initialSize = "all",
  initialCondition = "all",
}: ApparelLifestyleListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [apparel, setApparel] = useState(initialApparel)
  const [size, setSize] = useState(initialSize)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, apparel, size, condition })
  stateRef.current = { q, apparel, size, condition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setApparel(initialApparel)
    setSize(initialSize)
    setCondition(initialCondition)
  }, [initialQ, initialApparel, initialSize, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.apparel && f.apparel !== "all") params.set("apparel", f.apparel)
      if (f.size && f.size !== "all") params.set("size", f.size)
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
          listboxId="apparel-lifestyle-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="apparel"
          value={apparel}
          onValueChange={(v) => { setApparel(v); pushFilters({ apparel: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={apparel === "all" ? "text-muted-foreground" : ""}>
              {apparel === "all"
                ? "Apparel type"
                : APPAREL_KIND_OPTIONS.find((o) => o.value === apparel)?.label ?? apparel}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {APPAREL_KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="size"
          value={size}
          onValueChange={(v) => { setSize(v); pushFilters({ size: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any size</SelectItem>
            {APPAREL_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
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
            {apparelConditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
