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
  COLLECTIBLE_TYPE_OPTIONS,
  COLLECTIBLE_ERA_OPTIONS,
  COLLECTIBLE_CONDITION_OPTIONS,
} from "@/lib/collectible-options"

interface CollectiblesListingsFiltersProps {
  initialQ?: string
  initialCollectibleType?: string
  initialCollectibleEra?: string
  initialCollectibleCondition?: string
}

export function CollectiblesListingsFilters({
  initialQ = "",
  initialCollectibleType = "all",
  initialCollectibleEra = "all",
  initialCollectibleCondition = "all",
}: CollectiblesListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [collectibleType, setCollectibleType] = useState(initialCollectibleType)
  const [collectibleEra, setCollectibleEra] = useState(initialCollectibleEra)
  const [collectibleCondition, setCollectibleCondition] = useState(initialCollectibleCondition)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (collectibleType && collectibleType !== "all") params.set("collectibleType", collectibleType)
    if (collectibleEra && collectibleEra !== "all") params.set("collectibleEra", collectibleEra)
    if (collectibleCondition && collectibleCondition !== "all") params.set("collectibleCondition", collectibleCondition)
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
          listboxId="collectibles-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select name="collectibleType" value={collectibleType} onValueChange={setCollectibleType}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {COLLECTIBLE_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="collectibleEra" value={collectibleEra} onValueChange={setCollectibleEra}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Era" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any era</SelectItem>
            {COLLECTIBLE_ERA_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select name="collectibleCondition" value={collectibleCondition} onValueChange={setCollectibleCondition}>
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any condition</SelectItem>
            {COLLECTIBLE_CONDITION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
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
