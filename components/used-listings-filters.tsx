"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
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

interface UsedListingsFiltersProps {
  categoryOptions: { value: string; label: string }[]
  initialQ?: string
  initialCategory?: string
  initialCondition?: string
  initialMinPrice?: string
  initialMaxPrice?: string
  initialSort?: string
}

export function UsedListingsFilters({
  categoryOptions,
  initialQ = "",
  initialCategory = "all",
  initialCondition = "all",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialSort = "newest",
}: UsedListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [category, setCategory] = useState(initialCategory)
  const [condition, setCondition] = useState(initialCondition)
  const [minPrice, setMinPrice] = useState(initialMinPrice)
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice)
  const [sort, setSort] = useState(initialSort)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (category && category !== "all") params.set("category", category)
    if (condition && condition !== "all") params.set("condition", condition)
    if (minPrice.trim()) params.set("minPrice", minPrice.trim())
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim())
    if (sort && sort !== "newest") params.set("sort", sort)
    params.set("page", "1")
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-nowrap gap-3 items-end">
      <div className="flex-1 min-w-[180px] max-w-[360px] shrink">
        <SearchInputWithSuggest
          value={q}
          onChange={setQ}
          placeholder="Search listings..."
          section="used"
          leftIcon={<Search className="h-4 w-4" />}
          name="q"
          listboxId="used-search-suggestions"
          showTypeLabels={false}
        />
      </div>

      <div className="w-[180px] shrink-0">
        <Select name="category" value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Category" />
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

      <div className="w-[150px] shrink-0">
        <Select name="condition" value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Condition" />
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

      <div className="flex gap-2 items-end shrink-0">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Min $</label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-[80px] h-10"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Max $</label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-[80px] h-10"
          />
        </div>
      </div>

      <div className="w-[170px] shrink-0">
        <Select name="sort" value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Sort by" />
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

      <Button type="submit" disabled={isPending} className="shrink-0 h-10">
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  )
}
