"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, SlidersHorizontal } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SINGLE_FIN_SIZE_OPTIONS, USED_GEAR_SIZE_OPTIONS } from "@/lib/used-gear-filter-options"

const conditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
]

interface FinsListingsFiltersProps {
  brandOptions: string[]
  initialQ?: string
  initialBrand?: string
  initialSize?: string
  initialCondition?: string
  initialSort?: string
}

export function FinsListingsFilters({
  brandOptions,
  initialQ = "",
  initialBrand = "all",
  initialSize = "all",
  initialCondition = "all",
  initialSort = "newest",
}: FinsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [brand, setBrand] = useState(initialBrand)
  const [size, setSize] = useState(initialSize)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (brand && brand !== "all") params.set("brand", brand)
    if (size && size !== "all") params.set("size", size)
    if (condition && condition !== "all") params.set("condition", condition)
    if (sort && sort !== "newest") params.set("sort", sort)
    params.set("page", "1")
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
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
        <Select name="brand" value={brand} onValueChange={setBrand}>
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
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="size" value={size} onValueChange={setSize}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Size</SelectItem>
            {USED_GEAR_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
            {SINGLE_FIN_SIZE_OPTIONS.map((s) => (
              <SelectItem key={`sf-${s}`} value={s}>
                {`${s}" (single fin)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="condition" value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any Condition" />
          </SelectTrigger>
          <SelectContent>
            {conditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>
                {cond.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[150px] md:shrink-0">
        <Select name="sort" value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Newest First" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending} className="col-span-2 h-10 px-4 md:col-auto md:shrink-0">
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  )
}
