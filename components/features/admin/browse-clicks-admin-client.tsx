"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BROWSE_BUTTON_CATEGORIES,
  BROWSE_BUTTON_CATEGORY_LABELS,
  BROWSE_BUTTON_LABELS,
  browseFacetKeyLabel,
  type BrowseButtonCategory,
  type BrowseButtonKey,
} from "@/lib/browse-button-tracking"
import type {
  BrowseButtonAnalyticsDashboard,
  BrowseButtonFacetCategoryRow,
} from "@/lib/types/browseButtonAnalytics"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const

function fmt(n: number): string {
  return n.toLocaleString()
}

function categoryLabel(slug: string): string {
  if ((BROWSE_BUTTON_CATEGORIES as readonly string[]).includes(slug)) {
    return BROWSE_BUTTON_CATEGORY_LABELS[slug as BrowseButtonCategory]
  }
  return slug
}

function buttonLabel(key: string): string {
  if (key in BROWSE_BUTTON_LABELS) {
    return BROWSE_BUTTON_LABELS[key as BrowseButtonKey]
  }
  return key
}

function detailLabel(
  button: string,
  detail: string | null,
  facetKey: string | null,
  facetValue: string | null,
): string {
  if (button === "facet") {
    const key = facetKey ? browseFacetKeyLabel(facetKey) : "Filter"
    const value = facetValue && facetValue !== "(any)" ? facetValue : null
    const action = detail ?? ""
    if (value) return `${key}: ${value}${action ? ` (${action})` : ""}`
    return `${key}${action ? ` (${action})` : ""}`
  }
  if (!detail) return "—"
  if (button === "ship_to_me") {
    if (detail === "enabled") return "Turned on"
    if (detail === "disabled") return "Turned off"
  }
  if (button === "filter") {
    if (detail === "mobile") return "Mobile"
    if (detail === "desktop") return "Desktop"
  }
  return detail
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
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  )
}

export function BrowseClicksAdminClient() {
  const [days, setDays] = useState("30")
  const [data, setData] = useState<BrowseButtonAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const queryString = useMemo(() => new URLSearchParams({ days }).toString(), [days])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !initialAttemptDoneRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)

      try {
        const res = await fetch(`/api/admin/browse-clicks?${queryString}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(
            typeof body.error === "string" ? body.error : "Could not load browse click data.",
          )
          setData(null)
          return
        }
        if (body.data && typeof body.data === "object") {
          setData(body.data as BrowseButtonAnalyticsDashboard)
        } else {
          setError("Invalid response from server")
          setData(null)
        }
      } catch {
        setError("Could not load browse click data.")
        setData(null)
      } finally {
        if (firstEver) {
          setLoading(false)
          initialAttemptDoneRef.current = true
        } else if (!opts?.silent) {
          setRefreshing(false)
        }
      }
    },
    [queryString],
  )

  useEffect(() => {
    void load()
  }, [load])

  const filterRows = useMemo(() => {
    if (!data) return []
    const bySlug = new Map(data.filterByCategory.map((r) => [r.category, r]))
    return BROWSE_BUTTON_CATEGORIES.map((category) => {
      const row = bySlug.get(category)
      return {
        category,
        count: row?.count ?? 0,
        uniqueUsers: row?.uniqueUsers ?? 0,
        mobile: row?.mobile ?? 0,
        desktop: row?.desktop ?? 0,
      }
    }).sort((a, b) => b.count - a.count)
  }, [data])

  const facetsByCategory = useMemo(() => {
    const map = new Map<string, BrowseButtonFacetCategoryRow[]>()
    for (const category of BROWSE_BUTTON_CATEGORIES) {
      map.set(category, [])
    }
    for (const row of data?.facetsByCategory ?? []) {
      const list = map.get(row.category) ?? []
      list.push(row)
      map.set(row.category, list)
    }
    return map
  }, [data?.facetsByCategory])

  const summary = data?.summary
  const ship = data?.shipToMe

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse clicks</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            First-party clicks on category browse toolbar buttons and individual facet filters:{" "}
            <strong className="font-medium text-foreground">Ship to me</strong> on `/boards`,{" "}
            <strong className="font-medium text-foreground">Filter</strong> panel opens, and every
            checkbox / brand / price control inside the sidebar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={loading || refreshing}
            onClick={() => void load()}
            aria-label="Refresh"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading browse click analytics…
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Total clicks" value={fmt(summary.totalClicks)} />
          <StatTile
            label="Ship to me"
            value={fmt(summary.shipToMeClicks)}
            hint="From /boards toolbar"
          />
          <StatTile
            label="Filter opens"
            value={fmt(summary.filterClicks)}
            hint="Header Filter button"
          />
          <StatTile
            label="Facet filters"
            value={fmt(summary.facetClicks)}
            hint="Individual filter controls"
          />
          <StatTile
            label="Signed-in users"
            value={fmt(summary.uniqueUsers)}
            hint="Distinct logged-in clickers"
          />
        </div>
      ) : null}

      {/* Ship to me — dedicated section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Ship to me</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle clicks from the `/boards` page header button (not the sidebar checkbox).
          </p>
        </div>
        {ship ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Total clicks" value={fmt(ship.total)} />
              <StatTile label="Turned on" value={fmt(ship.enabled)} />
              <StatTile label="Turned off" value={fmt(ship.disabled)} />
              <StatTile label="Signed-in users" value={fmt(ship.uniqueUsers)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Ship to me clicks</CardTitle>
                <CardDescription>UTC days in the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                {ship.dailyTrend.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Ship to me clicks yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...ship.dailyTrend].reverse().map((row) => (
                        <TableRow key={row.date}>
                          <TableCell className="tabular-nums">{row.date}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>

      {/* Filter panel opens by category */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Filter panel opens</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Header Filter button clicks on each category browse page, split by mobile sheet vs
            desktop sidebar toggle.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Mobile</TableHead>
                  <TableHead className="text-right">Desktop</TableHead>
                  <TableHead className="text-right">Signed-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterRows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{categoryLabel(row.category)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.count === 0 && "text-muted-foreground",
                      )}
                    >
                      {fmt(row.count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(row.mobile)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(row.desktop)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(row.uniqueUsers)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Individual facet filters by category */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Facet filters by category</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Clicks on each individual filter control (checkboxes, brand, price, etc.) inside the
            category sidebar / mobile sheet.
          </p>
        </div>
        <div className="space-y-4">
          {BROWSE_BUTTON_CATEGORIES.map((category) => {
            const rows = facetsByCategory.get(category) ?? []
            const total = rows.reduce((sum, r) => sum + r.count, 0)
            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-base">{categoryLabel(category)}</CardTitle>
                    <CardDescription className="tabular-nums">
                      {fmt(total)} facet click{total === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No facet filter clicks yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filter</TableHead>
                          <TableHead>Option</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Select</TableHead>
                          <TableHead className="text-right">Deselect</TableHead>
                          <TableHead className="text-right">Set / clear</TableHead>
                          <TableHead className="text-right">Signed-in</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={`${row.facetKey}:${row.facetValue}`}>
                            <TableCell className="font-medium">
                              {browseFacetKeyLabel(row.facetKey)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.facetValue === "(any)" ? "—" : row.facetValue}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmt(row.count)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt(row.selectCount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt(row.deselectCount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt(row.setCount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt(row.uniqueUsers)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Combined daily trend */}
      {data && data.dailyTrend.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Daily trend</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ship to me, Filter opens, and facet filter clicks per UTC day.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Ship to me</TableHead>
                    <TableHead className="text-right">Filter</TableHead>
                    <TableHead className="text-right">Facets</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.dailyTrend].reverse().map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="tabular-nums">{row.date}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(row.shipToMe)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.filter)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.facet)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmt(row.shipToMe + row.filter + row.facet)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Recent events */}
      {data ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Recent clicks</h2>
            <p className="text-sm text-muted-foreground mt-1">Latest 50 events in the range.</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              {data.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Button</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentEvents.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">
                          {(() => {
                            try {
                              return formatDistanceToNow(parseISO(row.createdAt), {
                                addSuffix: true,
                              })
                            } catch {
                              return row.createdAt
                            }
                          })()}
                        </TableCell>
                        <TableCell>{categoryLabel(row.category)}</TableCell>
                        <TableCell>{buttonLabel(row.button)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {detailLabel(row.button, row.detail, row.facetKey, row.facetValue)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.userId ? `${row.userId.slice(0, 8)}…` : "Guest"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
