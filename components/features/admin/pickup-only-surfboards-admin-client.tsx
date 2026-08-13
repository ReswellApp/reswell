"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { Copy, Download, Loader2, MapPin, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  PickupOnlyLocality,
  PickupOnlySurfboardListing,
  PickupOnlySurfboardsDashboard,
} from "@/lib/services/pickupOnlySurfboards"
import { PICKUP_AD_RADIUS_MILES } from "@/lib/services/pickupOnlySurfboards"
import { PickupOnlySurfboardsListingTable } from "@/components/features/admin/pickup-only-surfboards-listing-table"

const PickupOnlySurfboardsMap = dynamic(
  () =>
    import("@/components/features/admin/pickup-only-surfboards-map").then(
      (mod) => mod.PickupOnlySurfboardsMap,
    ),
  {
    ssr: false,
    loading: () => <div className="h-[480px] rounded-xl border border-border bg-muted" />,
  },
)

const ALL_STATES = "all"

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function buildAdBrief(locality: PickupOnlyLocality): string {
  const lines = [
    `Local pickup surfboards — ${locality.label}`,
    `${locality.listingCount} board${locality.listingCount === 1 ? "" : "s"} · ${formatUsd(locality.inventoryValue)} listed · avg ${formatUsd(locality.averagePrice)} · avg ${Math.round(locality.averageDaysListed)} days listed`,
    `Suggested targeting: ${locality.label} within ${PICKUP_AD_RADIUS_MILES} miles`,
    "",
    ...locality.listings.map((listing) => `${listing.title} — ${formatUsd(listing.price)}\n${listing.absoluteUrl}`),
  ]
  return lines.join("\n")
}

export function PickupOnlySurfboardsAdminClient({
  initialData,
}: {
  initialData: PickupOnlySurfboardsDashboard
}) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState(ALL_STATES)
  const [query, setQuery] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch("/api/admin/pickup-only-surfboards", {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await res.json()) as { data?: PickupOnlySurfboardsDashboard; error?: string }
        if (!res.ok || !json.data) {
          setError(json.error || "Could not load pickup-only boards")
          return
        }
        setData(json.data)
      } catch {
        setError("Could not load pickup-only boards")
      }
    })
  }, [])

  const filteredLocalities = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.localities.filter((locality) => {
      if (stateFilter !== ALL_STATES && locality.state !== stateFilter) return false
      if (!q) return true
      if (locality.label.toLowerCase().includes(q)) return true
      return locality.listings.some((listing) => {
        const hay = [listing.title, listing.brand, listing.model].filter(Boolean).join(" ").toLowerCase()
        return hay.includes(q)
      })
    })
  }, [data.localities, stateFilter, query])

  const selectedLocality = useMemo(
    () => filteredLocalities.find((locality) => locality.key === selectedKey) ?? null,
    [filteredLocalities, selectedKey],
  )

  const visibleListings: PickupOnlySurfboardListing[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const source = selectedLocality
      ? selectedLocality.listings
      : filteredLocalities.flatMap((locality) => locality.listings)
    if (!q) return source
    return source.filter((listing) => {
      const hay = [listing.title, listing.brand, listing.model, listing.city, listing.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [filteredLocalities, selectedLocality, query])

  const copyAdBrief = useCallback(async () => {
    if (!selectedLocality) {
      toast.error("Select a city first")
      return
    }
    try {
      await navigator.clipboard.writeText(buildAdBrief(selectedLocality))
      toast.success(`Copied ad brief for ${selectedLocality.label}`)
    } catch {
      toast.error("Could not copy")
    }
  }, [selectedLocality])

  const exportLocalities = useCallback(() => {
    downloadCsv(
      "pickup-only-localities.csv",
      ["city", "state", "label", "listing_count", "inventory_value", "avg_price", "avg_days_listed", "has_map_pin"],
      filteredLocalities.map((locality) => [
        locality.city ?? "",
        locality.state ?? "",
        locality.label,
        locality.listingCount,
        Math.round(locality.inventoryValue),
        Math.round(locality.averagePrice),
        Math.round(locality.averageDaysListed),
        locality.latitude != null ? "yes" : "no",
      ]),
    )
  }, [filteredLocalities])

  const exportListings = useCallback(() => {
    const rows = visibleListings
    const suffix = selectedLocality ? selectedLocality.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "all"
    downloadCsv(
      `pickup-only-listings-${suffix}.csv`,
      ["title", "price", "city", "state", "url", "image", "days_listed", "views", "brand", "model", "condition"],
      rows.map((listing) => [
        listing.title,
        Math.round(listing.price),
        listing.city ?? "",
        listing.state ?? "",
        listing.absoluteUrl,
        listing.thumbnailUrl ?? "",
        listing.daysListed,
        listing.views,
        listing.brand ?? "",
        listing.model ?? "",
        listing.conditionLabel ?? "",
      ]),
    )
  }, [visibleListings, selectedLocality])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATES}>All states</SelectItem>
            {data.states.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city, brand, or title"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportLocalities}>
          <Download className="h-4 w-4" />
          Cities CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportListings}>
          <Download className="h-4 w-4" />
          Listings CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyAdBrief} disabled={!selectedLocality}>
          <Copy className="h-4 w-4" />
          Copy ad brief
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pickup-only boards"
          value={formatNumber(data.listingCount)}
          hint={`${formatNumber(filteredLocalities.reduce((n, loc) => n + loc.listingCount, 0))} in this view`}
        />
        <StatTile
          label="Cities"
          value={formatNumber(data.localityCount)}
          hint="Where local ads can run"
        />
        <StatTile
          label="Listed value"
          value={formatUsd(data.inventoryValue)}
          hint={`Avg ${formatUsd(data.averagePrice)}`}
        />
        <StatTile
          label="Mapped"
          value={`${formatNumber(data.mappedListingCount)} / ${formatNumber(data.listingCount)}`}
          hint={
            data.unmappedListingCount > 0
              ? `${formatNumber(data.unmappedListingCount)} missing lat/lng`
              : `Target ~${PICKUP_AD_RADIUS_MILES} mi around each city`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Cities</p>
            <p className="text-xs text-muted-foreground">
              Sorted by board count. Click to focus the map and ad brief.
            </p>
          </div>
          <ScrollArea className="h-[480px]">
            <ul className="p-1">
              {filteredLocalities.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">No cities match.</li>
              ) : (
                filteredLocalities.map((locality) => {
                  const selected = locality.key === selectedKey
                  return (
                    <li key={locality.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(selected ? null : locality.key)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          selected ? "bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{locality.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {locality.listingCount} board{locality.listingCount === 1 ? "" : "s"} ·{" "}
                            {formatUsd(locality.inventoryValue)}
                            {locality.latitude == null ? " · no pin" : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </ScrollArea>
        </div>
        <PickupOnlySurfboardsMap
          localities={filteredLocalities}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">
              {selectedLocality ? selectedLocality.label : "All pickup-only boards"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedLocality
                ? `Suggested Meta/Google targeting: ${selectedLocality.label} + ${PICKUP_AD_RADIUS_MILES} mile radius`
                : "Select a city to copy an ad brief with listing URLs."}
            </p>
          </div>
          {selectedLocality ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKey(null)}>
              Show all
            </Button>
          ) : null}
        </div>
        <PickupOnlySurfboardsListingTable listings={visibleListings} />
      </div>
    </div>
  )
}
