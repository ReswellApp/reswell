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
import { BOARD_BAG_LENGTH_OPTIONS } from "@/lib/board-bag-length-options"

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

interface BoardBagsListingsFiltersProps {
  initialQ?: string
  initialBoardBag?: string
  initialSize?: string
  initialCondition?: string
  initialSort?: string
}

export function BoardBagsListingsFilters({
  initialQ = "",
  initialBoardBag = "all",
  initialSize = "all",
  initialCondition = "all",
  initialSort = "newest",
}: BoardBagsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [boardBag, setBoardBag] = useState(initialBoardBag)
  const [size, setSize] = useState(initialSize)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (boardBag && boardBag !== "all") params.set("boardBag", boardBag)
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
          listboxId="board-bags-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select name="boardBag" value={boardBag} onValueChange={setBoardBag}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <span className={boardBag === "all" ? "text-muted-foreground" : ""}>
              {boardBag === "all"
                ? "Board Bags"
                : boardBag === "day"
                  ? "Day Bags"
                  : "Travel Bags"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both</SelectItem>
            <SelectItem value="day">Day Bags</SelectItem>
            <SelectItem value="travel">Travel Bags</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="size" value={size} onValueChange={setSize}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Any size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any size</SelectItem>
            {BOARD_BAG_LENGTH_OPTIONS.map((len) => (
              <SelectItem key={len} value={len}>
                {len}
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
