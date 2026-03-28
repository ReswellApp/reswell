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

const conditions = [
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

export function UsedListingsFilters({
  categoryOptions,
  initialQ = "",
  initialCategory = "all",
  initialCondition = "all",
}: UsedListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [category, setCategory] = useState(initialCategory)
  const [condition, setCondition] = useState(initialCondition)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (category && category !== "all") params.set("category", category)
    if (condition && condition !== "all") params.set("condition", condition)
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
          listboxId="used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select name="category" value={category} onValueChange={setCategory}>
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
      <Button type="submit" disabled={isPending} className="col-span-2 h-10 px-4 md:col-auto md:shrink-0">
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  )
}
