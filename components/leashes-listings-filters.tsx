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
import { LEASH_LENGTH_FT_OPTIONS, LEASH_THICKNESS_OPTIONS, leashLengthLabel } from "@/lib/leash-options"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export const leashConditions = [
  { value: "all", label: "Any Condition" },
  ...listingConditionFilterRows(),
]

interface LeashesListingsFiltersProps {
  initialQ?: string
  initialLeashLength?: string
  initialLeashThickness?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function LeashesListingsFilters({
  initialQ = "",
  initialLeashLength = "all",
  initialLeashThickness = "all",
  initialCondition = "all",
}: LeashesListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [leashLength, setLeashLength] = useState(initialLeashLength)
  const [leashThickness, setLeashThickness] = useState(initialLeashThickness)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, leashLength, leashThickness, condition })
  stateRef.current = { q, leashLength, leashThickness, condition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setLeashLength(initialLeashLength)
    setLeashThickness(initialLeashThickness)
    setCondition(initialCondition)
  }, [initialQ, initialLeashLength, initialLeashThickness, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.leashLength && f.leashLength !== "all") params.set("leashLength", f.leashLength)
      if (f.leashThickness && f.leashThickness !== "all") params.set("leashThickness", f.leashThickness)
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
          listboxId="leashes-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="leashLength"
          value={leashLength}
          onValueChange={(v) => { setLeashLength(v); pushFilters({ leashLength: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Length" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any length</SelectItem>
            {LEASH_LENGTH_FT_OPTIONS.map((ft) => (
              <SelectItem key={ft} value={ft}>{leashLengthLabel(ft)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="leashThickness"
          value={leashThickness}
          onValueChange={(v) => { setLeashThickness(v); pushFilters({ leashThickness: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Thickness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any thickness</SelectItem>
            {LEASH_THICKNESS_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{`${t}"`}</SelectItem>
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
            {leashConditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
