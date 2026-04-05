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
import { SURFPACKS_BAGS_CURATED_BRANDS } from "@/lib/surfpacks-bags-brands"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export const surfpacksConditions = [
  { value: "all", label: "Any Condition" },
  ...listingConditionFilterRows(),
]

interface SurfpacksBagsListingsFiltersProps {
  brandOptions: string[]
  initialQ?: string
  initialPack?: string
  initialBrand?: string
  initialCondition?: string
}

const DEBOUNCE_MS = 350

export function SurfpacksBagsListingsFilters({
  brandOptions,
  initialQ = "",
  initialPack = "all",
  initialBrand = "all",
  initialCondition = "all",
}: SurfpacksBagsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [pack, setPack] = useState(initialPack)
  const [brand, setBrand] = useState(initialBrand)
  const [condition, setCondition] = useState(initialCondition)

  const stateRef = useRef({ q, pack, brand, condition })
  stateRef.current = { q, pack, brand, condition }

  const extraBrandOptions = brandOptions.filter(
    (b) => !(SURFPACKS_BAGS_CURATED_BRANDS as readonly string[]).includes(b),
  )

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setPack(initialPack)
    setBrand(initialBrand)
    setCondition(initialCondition)
  }, [initialQ, initialPack, initialBrand, initialCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.pack && f.pack !== "all") params.set("pack", f.pack)
      if (f.brand && f.brand !== "all") params.set("brand", f.brand)
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
          listboxId="surfpacks-bags-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="pack"
          value={pack}
          onValueChange={(v) => { setPack(v); pushFilters({ pack: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={pack === "all" ? "text-muted-foreground" : ""}>
              {pack === "all" ? "Pack Type" : pack === "surfpack" ? "Surfpacks" : "Bags"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both</SelectItem>
            <SelectItem value="surfpack">Surfpacks</SelectItem>
            <SelectItem value="bag">Bags</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="brand"
          value={brand}
          onValueChange={(v) => { setBrand(v); pushFilters({ brand: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={brand === "all" ? "text-muted-foreground" : ""}>
              {brand === "all" ? "Brand" : brand}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {SURFPACKS_BAGS_CURATED_BRANDS.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
            {extraBrandOptions.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
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
            {surfpacksConditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
