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
import {
  WETSUIT_SIZE_OPTIONS,
  WETSUIT_THICKNESS_OPTIONS,
  WETSUIT_ZIP_OPTIONS,
} from "@/lib/wetsuit-options"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export const wetsuitConditions = [
  { value: "all", label: "Any Condition" },
  ...listingConditionFilterRows(),
]

interface WetsuitsListingsFiltersProps {
  initialQ?: string
  initialSize?: string
  initialThickness?: string
  initialZipType?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function WetsuitsListingsFilters({
  initialQ = "",
  initialSize = "all",
  initialThickness = "all",
  initialZipType = "all",
  initialCondition = "all",
}: WetsuitsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [size, setSize] = useState(initialSize)
  const [thickness, setThickness] = useState(initialThickness)
  const [zipType, setZipType] = useState(initialZipType)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, size, thickness, zipType, condition })
  stateRef.current = { q, size, thickness, zipType, condition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setSize(initialSize)
    setThickness(initialThickness)
    setZipType(initialZipType)
    setCondition(initialCondition)
  }, [initialQ, initialSize, initialThickness, initialZipType, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.size && f.size !== "all") params.set("size", f.size)
      if (f.thickness && f.thickness !== "all") params.set("thickness", f.thickness)
      if (f.zipType && f.zipType !== "all") params.set("zipType", f.zipType)
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
          listboxId="wetsuits-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="size"
          value={size}
          onValueChange={(v) => { setSize(v); pushFilters({ size: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any size</SelectItem>
            {WETSUIT_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="thickness"
          value={thickness}
          onValueChange={(v) => { setThickness(v); pushFilters({ thickness: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Thickness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any thickness</SelectItem>
            {WETSUIT_THICKNESS_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="zipType"
          value={zipType}
          onValueChange={(v) => { setZipType(v); pushFilters({ zipType: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={zipType === "all" ? "text-muted-foreground" : ""}>
              {zipType === "all"
                ? "Zip type"
                : WETSUIT_ZIP_OPTIONS.find((o) => o.value === zipType)?.label ?? zipType}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any zip</SelectItem>
            {WETSUIT_ZIP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
            {wetsuitConditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
