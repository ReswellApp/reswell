"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideSearchHit } from "@/lib/types/price-guide"
import { cn } from "@/lib/utils"

type PriceGuideSearchProps = {
  hits: PriceGuideSearchHit[]
  className?: string
}

export function PriceGuideSearch({ hits, className }: PriceGuideSearchProps) {
  const [query, setQuery] = useState("")
  const normalized = query.trim().toLowerCase()

  const matches = useMemo(() => {
    if (normalized.length < 1) return []
    return hits
      .filter((hit) => `${hit.label} ${hit.sublabel}`.toLowerCase().includes(normalized))
      .slice(0, 8)
  }, [hits, normalized])

  return (
    <div className={cn("relative w-full", className)}>
      <label className="relative block">
        <span className="sr-only">Search the price guide</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a brand or model — Lost, CI Twin Pin, O’Neill…"
          className="h-14 rounded-2xl border-border/80 bg-background pl-12 text-base shadow-sm"
        />
      </label>
      {matches.length > 0 ? (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border/80 bg-background shadow-lg">
          {matches.map((hit) => (
            <li key={`${hit.kind}:${hit.href}`}>
              <Link
                href={hit.href}
                className="flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{hit.label}</span>
                  <span className="block text-xs text-muted-foreground">{hit.sublabel}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatGuideUsd(hit.mid_usd)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
