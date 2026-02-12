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
import { Search, MapPin, SlidersHorizontal } from "lucide-react"

const boardTypes = [
  { value: "all", label: "All Board Types" },
  { value: "shortboard", label: "Shortboard" },
  { value: "longboard", label: "Longboard" },
  { value: "funboard", label: "Funboard / Mid-length" },
  { value: "fish", label: "Fish" },
  { value: "gun", label: "Gun" },
  { value: "foamie", label: "Foam / Soft Top" },
  { value: "other", label: "Other" },
]

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
  { value: "nearest", label: "Nearest First" },
]

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialLocation?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
}

export function BoardsListingsFilters({
  initialQ = "",
  initialLocation = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = "newest",
}: BoardsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [location, setLocation] = useState(initialLocation)
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (location.trim()) params.set("location", location.trim())
    if (type && type !== "all") params.set("type", type)
    if (condition && condition !== "all") params.set("condition", condition)
    if (sort && sort !== "newest") params.set("sort", sort)
    params.set("page", "1")
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Search surfboards..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          name="location"
          placeholder="City or ZIP..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="pl-10 w-[150px]"
        />
      </div>

      <Select name="type" value={type} onValueChange={setType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Board Type" />
        </SelectTrigger>
        <SelectContent>
          {boardTypes.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select name="condition" value={condition} onValueChange={setCondition}>
        <SelectTrigger className="w-[150px]">
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

      <Select name="sort" value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-[160px]">
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

      <Button type="submit" disabled={isPending}>
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        {isPending ? "Applying..." : "Apply"}
      </Button>
    </form>
  )
}
