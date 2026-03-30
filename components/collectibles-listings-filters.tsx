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

const DEBOUNCE_MS = 350

export function CollectiblesListingsFilters({
  initialQ = "",
  initialCollectibleType = "all",
  initialCollectibleEra = "all",
  initialCollectibleCondition = "all",
}: CollectiblesListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [collectibleType, setCollectibleType] = useState(initialCollectibleType)
  const [collectibleEra, setCollectibleEra] = useState(initialCollectibleEra)
  const [collectibleCondition, setCollectibleCondition] = useState(initialCollectibleCondition)

  const stateRef = useRef({ q, collectibleType, collectibleEra, collectibleCondition })
  stateRef.current = { q, collectibleType, collectibleEra, collectibleCondition }

  // Sync filter UI when server re-renders with new searchParams (back/forward nav)
  const skipQ = useRef(true)
  useEffect(() => {
    skipQ.current = true
    setQ(initialQ)
    setCollectibleType(initialCollectibleType)
    setCollectibleEra(initialCollectibleEra)
    setCollectibleCondition(initialCollectibleCondition)
  }, [initialQ, initialCollectibleType, initialCollectibleEra, initialCollectibleCondition])

  const pushFilters = useCallback(
    (override?: Partial<typeof stateRef.current>) => {
      const f = { ...stateRef.current, ...override }
      const params = new URLSearchParams()
      if (f.q.trim()) params.set("q", f.q.trim())
      if (f.collectibleType && f.collectibleType !== "all") params.set("collectibleType", f.collectibleType)
      if (f.collectibleEra && f.collectibleEra !== "all") params.set("collectibleEra", f.collectibleEra)
      if (f.collectibleCondition && f.collectibleCondition !== "all") params.set("collectibleCondition", f.collectibleCondition)
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
          listboxId="collectibles-search-suggestions"
          showTypeLabels={false}
          className="w-full"
          inputClassName="w-full box-border"
        />
      </div>
      <div className="w-full min-w-0 md:w-[160px] md:shrink-0">
        <Select
          name="collectibleType"
          value={collectibleType}
          onValueChange={(v) => { setCollectibleType(v); pushFilters({ collectibleType: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {COLLECTIBLE_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="collectibleEra"
          value={collectibleEra}
          onValueChange={(v) => { setCollectibleEra(v); pushFilters({ collectibleEra: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Era" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any era</SelectItem>
            {COLLECTIBLE_ERA_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 md:w-[130px] md:shrink-0">
        <Select
          name="collectibleCondition"
          value={collectibleCondition}
          onValueChange={(v) => { setCollectibleCondition(v); pushFilters({ collectibleCondition: v }) }}
        >
          <SelectTrigger className="w-full h-10 min-h-[2.5rem]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any condition</SelectItem>
            {COLLECTIBLE_CONDITION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}
