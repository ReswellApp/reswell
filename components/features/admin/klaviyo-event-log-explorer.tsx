"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Search,
  User,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  KlaviyoEventLogPageResult,
  KlaviyoMetricRow,
  NotificationsCenterRange,
} from "@/lib/db/klaviyoEventLog"
import type { KlaviyoEventStatusFilter } from "@/lib/validations/klaviyoEventExplorer"

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  skipped: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  failed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
}

const CATEGORY_STYLES = {
  transactional: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  lifecycle: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  engagement: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  marketing: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  other: "bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
} as const

export interface KlaviyoEventLogFilters {
  metric: string | null
  recipient: string | null
  status: KlaviyoEventStatusFilter
}

interface KlaviyoEventLogExplorerProps {
  range: NotificationsCenterRange
  metrics: KlaviyoMetricRow[]
  filters: KlaviyoEventLogFilters
  onFiltersChange: (next: KlaviyoEventLogFilters) => void
}

function formatDateTime(value: string): string {
  try {
    return format(new Date(value), "MMM d, yyyy h:mm a")
  } catch {
    return value
  }
}

function recipientLabel(row: {
  email: string | null
  externalId: string | null
  anonymousId: string | null
}): string {
  return row.email || row.externalId || row.anonymousId || "—"
}

function PropertiesPreview({ properties }: { properties: Record<string, unknown> | null }) {
  if (!properties || Object.keys(properties).length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
      {JSON.stringify(properties, null, 2)}
    </pre>
  )
}

export function KlaviyoEventLogExplorer({
  range,
  metrics,
  filters,
  onFiltersChange,
}: KlaviyoEventLogExplorerProps) {
  const [data, setData] = useState<KlaviyoEventLogPageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [recipientInput, setRecipientInput] = useState(filters.recipient ?? "")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setRecipientInput(filters.recipient ?? "")
  }, [filters.recipient])

  useEffect(() => {
    setPage(1)
  }, [range, filters.metric, filters.recipient, filters.status, pageSize])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        range,
        status: filters.status,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      })
      if (filters.metric) params.set("metric", filters.metric)
      if (filters.recipient) params.set("recipient", filters.recipient)

      const res = await fetch(`/api/admin/klaviyo-events?${params.toString()}`, {
        credentials: "include",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load events")
        return
      }
      setData(body.data as KlaviyoEventLogPageResult)
    } catch {
      setError("Could not load events")
    } finally {
      setLoading(false)
    }
  }, [range, filters.metric, filters.recipient, filters.status, page, pageSize])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, total)

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.metric) n += 1
    if (filters.recipient) n += 1
    if (filters.status !== "all") n += 1
    return n
  }, [filters])

  function applyRecipientSearch() {
    const next = recipientInput.trim() || null
    onFiltersChange({ ...filters, recipient: next })
  }

  function clearFilters() {
    setRecipientInput("")
    onFiltersChange({ metric: null, recipient: null, status: "all" })
  }

  const summary = data?.recipientSummary

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Event log</CardTitle>
          <p className="text-xs font-normal text-muted-foreground">
            Every Klaviyo event we fired in the selected window — searchable by metric, recipient,
            and status. Expand a row for full event properties.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Recipient</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Email or user id"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyRecipientSearch()
                  }}
                  className="h-9"
                />
                <Button type="button" variant="secondary" size="sm" onClick={applyRecipientSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex min-w-[180px] flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Metric / flow</label>
              <Select
                value={filters.metric ?? "all"}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, metric: v === "all" ? null : v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All metrics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All metrics</SelectItem>
                  {metrics.map((m) => (
                    <SelectItem key={m.metric} value={m.metric}>
                      {m.metric}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[140px] flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={filters.status}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, status: v as KlaviyoEventStatusFilter })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[100px] flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Per page</label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear filters ({activeFilterCount})
              </Button>
            )}
          </div>

          {summary && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    User journey
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.email || summary.externalId || summary.identifier}
                    {summary.externalId && summary.email ? (
                      <span className="ml-2 font-mono text-xs">({summary.externalId})</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm tabular-nums">
                  <span>{summary.total} events</span>
                  <span className="text-emerald-600">{summary.sent} sent</span>
                  <span className="text-amber-600">{summary.skipped} skipped</span>
                  <span className="text-rose-600">{summary.failed} failed</span>
                  <span className="text-muted-foreground">{summary.metrics.length} flows</span>
                </div>
              </div>
              {summary.metrics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.metrics.map((m) => (
                    <button
                      key={m.metric}
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, metric: m.metric })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      <span className="font-medium">{m.metric}</span>
                      <span className="text-muted-foreground">×{m.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading events…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="w-8 pb-2" aria-label="Expand" />
                      <th className="pb-2 pr-4 font-medium">When</th>
                      <th className="pb-2 pr-4 font-medium">Metric</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Recipient</th>
                      <th className="pb-2 font-medium">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rows.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No events match these filters.
                        </td>
                      </tr>
                    ) : (
                      data!.rows.map((row) => {
                        const isOpen = expandedId === row.id
                        const propCount = row.properties ? Object.keys(row.properties).length : 0
                        return (
                          <Fragment key={row.id}>
                            <tr className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedId(isOpen ? null : row.id)}
                                  aria-expanded={isOpen}
                                  aria-label={isOpen ? "Collapse row" : "Expand row"}
                                >
                                  {isOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                                <span title={formatDateTime(row.createdAt)}>
                                  {formatDistanceToNow(new Date(row.createdAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </td>
                              <td className="py-2 pr-4">
                                <button
                                  type="button"
                                  className="font-medium text-left hover:underline"
                                  onClick={() =>
                                    onFiltersChange({ ...filters, metric: row.metric })
                                  }
                                >
                                  {row.metric}
                                </button>
                              </td>
                              <td className="py-2 pr-4">
                                <Badge
                                  variant="secondary"
                                  className={cn("capitalize", STATUS_STYLES[row.status])}
                                >
                                  {row.status}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4">
                                <button
                                  type="button"
                                  className="text-left text-muted-foreground hover:text-foreground hover:underline"
                                  onClick={() => {
                                    const id =
                                      row.externalId || row.email || row.anonymousId
                                    if (id) {
                                      setRecipientInput(id)
                                      onFiltersChange({ ...filters, recipient: id })
                                    }
                                  }}
                                >
                                  {recipientLabel(row)}
                                </button>
                              </td>
                              <td className="py-2 text-xs text-muted-foreground">
                                {row.skipReason ||
                                  (row.httpStatus ? `HTTP ${row.httpStatus}` : null) ||
                                  (row.value != null
                                    ? `${row.value} ${row.valueCurrency ?? "USD"}`
                                    : null) ||
                                  (propCount > 0 ? `${propCount} properties` : "—")}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b border-border/40">
                                <td colSpan={6} className="pb-3 pt-0">
                                  <div className="ml-8 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                      <span>
                                        <span className="font-medium text-foreground">Time:</span>{" "}
                                        {formatDateTime(row.createdAt)}
                                      </span>
                                      {row.uniqueId && (
                                        <span>
                                          <span className="font-medium text-foreground">
                                            Dedupe id:
                                          </span>{" "}
                                          <code className="font-mono">{row.uniqueId}</code>
                                        </span>
                                      )}
                                      <Badge
                                        variant="secondary"
                                        className={cn("capitalize", CATEGORY_STYLES[row.category])}
                                      >
                                        {row.category}
                                      </Badge>
                                    </div>
                                    {row.detail && (
                                      <p className="text-xs text-rose-600">{row.detail}</p>
                                    )}
                                    <PropertiesPreview properties={row.properties} />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {total === 0
                    ? "No results"
                    : `Showing ${pageStart}–${pageEnd} of ${total.toLocaleString()} events`}
                  {loading && data ? (
                    <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
