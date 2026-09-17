"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Loader2, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { SearchAnalyticsQueryLookup } from "@/components/features/admin/search-analytics-query-lookup"
import type { SearchSourcingDashboard, SearchSourcingQueryRow } from "@/lib/services/searchSourcingDashboard"
import { BUSINESS_TIMEZONE_LABEL, formatBusinessDayKeyShort } from "@/lib/utils/business-timezone"
import { cn } from "@/lib/utils"

type QueryFilter = "all" | "none" | "thin"

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatAvgListings(value: number | null): string {
  if (value == null) return "—"
  if (value <= 0) return "0"
  return value < 10 ? value.toFixed(1) : String(Math.round(value))
}

function inventoryLabel(row: SearchSourcingQueryRow): string {
  if (row.inventory === "none") return "No listings"
  return `${formatAvgListings(row.avgResultCount)} listings avg`
}

function asSourcingRow(
  query: string,
  count: number,
): SearchSourcingQueryRow {
  return {
    query,
    display: query,
    count,
    avgResultCount: 0,
    inventory: "none",
  }
}

export function SearchAnalyticsAdminClient() {
  const [data, setData] = useState<SearchSourcingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueryFilter>("all")

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    setError(null)
    if (mode === "refresh") setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch("/api/admin/search-analytics", { credentials: "include" })
      const body = (await res.json().catch(() => ({}))) as {
        data?: SearchSourcingDashboard
        error?: string
      }
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load analytics")
        setData(null)
        return
      }
      setData(body.data ?? null)
    } catch {
      setError("Could not load analytics")
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load("initial")
  }, [load])

  const topTen = useMemo(() => (data?.topQueries ?? []).slice(0, 10), [data?.topQueries])

  const rankedQueries = useMemo(() => {
    const rows = [...(data?.topQueries ?? [])]
    const seen = new Set(rows.map((row) => row.query))
    for (const zero of data?.zeroResultQueries ?? []) {
      if (seen.has(zero.query)) continue
      rows.push(asSourcingRow(zero.query, zero.count))
      seen.add(zero.query)
    }
    return rows
  }, [data?.topQueries, data?.zeroResultQueries])

  const filteredQueries = useMemo(() => {
    if (filter === "all") return rankedQueries
    return rankedQueries.filter((row) => row.inventory === filter)
  }, [rankedQueries, filter])

  const sourceFirst = useMemo(
    () => rankedQueries.filter((row) => row.inventory === "none"),
    [rankedQueries],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Search analytics</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            What buyers search for on the marketplace. Use this as a sourcing list for
            boards we may not have.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 border-slate-200 bg-white"
          onClick={() => void load("refresh")}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading search analytics…
        </div>
      ) : data && !data.configured ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Search tracking is off</h3>
          <p className="mt-2 text-sm text-slate-600">
            Elasticsearch is not configured, so marketplace search counts are unavailable.
          </p>
        </div>
      ) : data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Today"
              value={formatCount(data.todayCount)}
              footnote={BUSINESS_TIMEZONE_LABEL}
            />
            <StatTile
              label="This week"
              value={formatCount(data.weekCount)}
              footnote="Last 7 days"
            />
            <StatTile
              label="All time"
              value={formatCount(data.allTimeCount)}
              footnote={
                data.uniqueQueriesApprox > 0
                  ? `${formatCount(data.uniqueQueriesApprox)} distinct queries`
                  : "Tracked searches"
              }
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Cumulative searches</h3>
              <p className="mt-1 text-sm text-slate-500">
                Running total of marketplace searches
                {data.firstOccurredAt
                  ? ` since ${format(parseISO(data.firstOccurredAt), "MMM d, yyyy")}`
                  : ""}
                .
              </p>
            </div>
            {data.volumeByDay.length === 0 || data.allTimeCount === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No marketplace searches have been tracked yet.
              </p>
            ) : (
              <ChartContainer
                config={{
                  cumulative: { label: "Cumulative", color: "hsl(221.2 83.2% 53.3%)" },
                }}
                className="aspect-auto h-[260px] w-full"
              >
                <AreaChart data={data.volumeByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="searchCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-cumulative)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-cumulative)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={(value) => formatBusinessDayKeyShort(String(value))}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(value) => formatCount(Number(value))}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0]?.payload as {
                        count?: number
                        cumulative?: number
                      }
                      let dateLabel = String(label ?? "")
                      try {
                        dateLabel = format(parseISO(String(label)), "MMM d, yyyy")
                      } catch {
                        // keep raw label
                      }
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <p className="font-medium text-foreground">{dateLabel}</p>
                          <p className="mt-1 tabular-nums text-muted-foreground">
                            Cumulative{" "}
                            <span className="font-medium text-foreground">
                              {formatCount(row.cumulative ?? 0)}
                            </span>
                          </p>
                          <p className="tabular-nums text-muted-foreground">
                            That day{" "}
                            <span className="font-medium text-foreground">
                              {formatCount(row.count ?? 0)}
                            </span>
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="var(--color-cumulative)"
                    strokeWidth={2}
                    fill="url(#searchCumulativeFill)"
                    name="Cumulative"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Top 10 most searched</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Highest-volume queries all time. Cards marked “No listings” are sourcing targets.
                </p>
              </div>
            </div>
            {topTen.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No search terms yet.
              </p>
            ) : (
              <Carousel opts={{ align: "start", dragFree: true }} className="px-10">
                <CarouselContent className="-ml-3">
                  {topTen.map((row, index) => (
                    <CarouselItem
                      key={row.query}
                      className="basis-[min(16.5rem,80vw)] pl-3 sm:basis-[14.5rem]"
                    >
                      <TopQueryCard row={row} rank={index + 1} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-0 border-slate-200" />
                <CarouselNext className="right-0 border-slate-200" />
              </Carousel>
            )}
          </section>

          {sourceFirst.length > 0 ? (
            <section className="rounded-xl border border-rose-100 bg-rose-50/40 p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Source these first</h3>
              <p className="mt-1 text-sm text-slate-600">
                Popular searches that returned no listings. Start here when buying inventory.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {sourceFirst.slice(0, 12).map((row) => (
                  <li key={row.query}>
                    <Link
                      href={`/search?q=${encodeURIComponent(row.display)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:border-rose-300"
                    >
                      <span className="font-medium">{row.display}</span>
                      <span className="tabular-nums text-slate-500">
                        {formatCount(row.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <SearchAnalyticsQueryLookup />

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">What&apos;s being searched</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Ranked by all-time volume. Open a query to see current marketplace results.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
                <FilterChip
                  label="Need to source"
                  active={filter === "none"}
                  onClick={() => setFilter("none")}
                />
                <FilterChip
                  label="Thin stock"
                  active={filter === "thin"}
                  onClick={() => setFilter("thin")}
                />
              </div>
            </div>
            {filteredQueries.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500 sm:px-6">
                {filter === "all"
                  ? "No marketplace searches have been tracked yet."
                  : "Nothing in this filter right now."}
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {filteredQueries.map((row, index) => (
                  <li key={row.query}>
                    <Link
                      href={`/search?q=${encodeURIComponent(row.display)}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:px-6"
                    >
                      <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                        {row.display}
                      </span>
                      <InventoryBadge row={row} />
                      <span className="shrink-0 text-sm tabular-nums text-slate-500">
                        {formatCount(row.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function StatTile({
  label,
  value,
  footnote,
}: {
  label: string
  value: string
  footnote: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{footnote}</p>
    </div>
  )
}

function TopQueryCard({ row, rank }: { row: SearchSourcingQueryRow; rank: number }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(row.display)}`}
      className={cn(
        "flex h-full min-h-[8.5rem] flex-col justify-between rounded-xl border bg-slate-50/80 p-4",
        row.inventory === "none"
          ? "border-rose-200"
          : row.inventory === "thin"
            ? "border-amber-200"
            : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums text-slate-400">#{rank}</span>
        <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
        {row.display}
      </p>
      <div className="mt-3">
        <p className="text-lg font-bold tabular-nums text-slate-900">
          {formatCount(row.count)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            row.inventory === "none"
              ? "font-medium text-rose-700"
              : row.inventory === "thin"
                ? "text-amber-700"
                : "text-slate-500",
          )}
        >
          {inventoryLabel(row)}
        </p>
      </div>
    </Link>
  )
}

function InventoryBadge({ row }: { row: SearchSourcingQueryRow }) {
  if (row.inventory === "none") {
    return (
      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
        No listings
      </span>
    )
  }
  if (row.inventory === "thin") {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        Thin stock
      </span>
    )
  }
  return (
    <span className="hidden shrink-0 text-[11px] tabular-nums text-slate-400 sm:inline">
      {formatAvgListings(row.avgResultCount)} avg results
    </span>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  )
}
