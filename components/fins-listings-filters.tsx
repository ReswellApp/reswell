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
import { SINGLE_FIN_SIZE_OPTIONS, USED_GEAR_SIZE_OPTIONS } from "@/lib/used-gear-filter-options"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export const finsConditions = [
  { value: "all", label: "Any Condition" },
  ...listingConditionFilterRows(),
]

interface FinsListingsFiltersProps {
  brandOptions: string[]
  initialQ?: string
  initialBrand?: string
  initialSize?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function FinsListingsFilters({
  brandOptions,
  initialQ = "",
  initialBrand = "all",
  initialSize = "all",
  initialCondition = "all",
}: FinsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [brand, setBrand] = useState(initialBrand)
  const [size, setSize] = useState(initialSize)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, brand, size, condition })
  stateRef.current = { q, brand, size, condition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setBrand(initialBrand)
    setSize(initialSize)
    setCondition(initialCondition)
  }, [initialQ, initialBrand, initialSize, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.brand && f.brand !== "all") params.set("brand", f.brand)
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
          listboxId="fins-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="brand"
          value={brand}
          onValueChange={(v) => { setBrand(v); pushFilters({ brand: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={brand === "all" ? "text-muted-foreground" : ""}>
              {brand === "all" ? "Any type" : brand}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            <SelectItem value="Futures">Futures</SelectItem>
            <SelectItem value="FCS">FCS</SelectItem>
            <SelectItem value="Single Fin">Single Fin</SelectItem>
            {brandOptions
              .filter((b) => b !== "Futures" && b !== "FCS" && b !== "Single Fin")
              .map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
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
            <SelectValue placeholder="Any Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Size</SelectItem>
            {USED_GEAR_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
            {SINGLE_FIN_SIZE_OPTIONS.map((s) => (
              <SelectItem key={`sf-${s}`} value={s}>{`${s}" (single fin)`}</SelectItem>
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
            {finsConditions.map((cond) => (
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
