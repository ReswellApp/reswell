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
import {
  WETSUIT_SIZE_OPTIONS,
  WETSUIT_THICKNESS_OPTIONS,
  WETSUIT_ZIP_OPTIONS,
} from "@/lib/wetsuit-options"

const conditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

interface WetsuitsListingsFiltersProps {
  initialQ?: string
  initialSize?: string
  initialThickness?: string
  initialZipType?: string
  initialCondition?: string
}

export function WetsuitsListingsFilters({
  initialQ = "",
  initialSize = "all",
  initialThickness = "all",
  initialZipType = "all",
  initialCondition = "all",
}: WetsuitsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [size, setSize] = useState(initialSize)
  const [thickness, setThickness] = useState(initialThickness)
  const [zipType, setZipType] = useState(initialZipType)
  const [condition, setCondition] = useState(initialCondition)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (size && size !== "all") params.set("size", size)
    if (thickness && thickness !== "all") params.set("thickness", thickness)
    if (zipType && zipType !== "all") params.set("zipType", zipType)
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
          listboxId="wetsuits-used-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="size" value={size} onValueChange={setSize}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any size</SelectItem>
            {WETSUIT_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="thickness" value={thickness} onValueChange={setThickness}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Thickness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any thickness</SelectItem>
            {WETSUIT_THICKNESS_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select name="zipType" value={zipType} onValueChange={setZipType}>
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
              <SelectItem key={o.value} value={o.value}>
                {o.label}
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
