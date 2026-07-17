"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react"

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
import { PEER_LISTING_SECTION_LABELS, PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import { sellFunnelStepLabel } from "@/lib/sell-flow/sell-funnel-step-labels"
import type { SellFunnelAnalyticsDashboard } from "@/lib/types/sellFunnelAnalytics"
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

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${n.toFixed(1)}%`
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: "good" | "warn" | "neutral"
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl tabular-nums",
            tone === "good" && "text-emerald-700",
            tone === "warn" && "text-amber-700",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  )
}

export function SellFunnelAdminClient() {
  const [days, setDays] = useState("30")
  const [listingType, setListingType] = useState<string>("all")
  const [data, setData] = useState<SellFunnelAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ days })
    if (listingType !== "all") params.set("listingType", listingType)
    return params.toString()
  }, [days, listingType])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !initialAttemptDoneRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)

      try {
        const res = await fetch(`/api/admin/sell-funnel?${queryString}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "Could not load sell funnel data.")
          setData(null)
          return
        }
        if (body.data && typeof body.data === "object") {
          setData(body.data as SellFunnelAnalyticsDashboard)
        } else {
          setError("Invalid response from server")
          setData(null)
        }
      } catch {
        setError("Could not load sell funnel data.")
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

  const stepRows = useMemo(() => {
    if (!data?.stepFunnel.length) return []
    return [...data.stepFunnel].sort((a, b) => b.viewed - a.viewed)
  }, [data?.stepFunnel])

  const summary = data?.summary

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sell funnel</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            First-party instrumentation from `/sell` publish flows: where sellers start, which steps
            they reach, validation blocks, and publish outcomes. Pair with Klaviyo{" "}
            <strong className="font-medium text-foreground">Viewed Sell Page</strong> /{" "}
            <strong className="font-medium text-foreground">Listing</strong> metrics for
            re-engagement.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Walk the flow as any user via{" "}
            <Link href="/admin/listings/add" className="text-primary underline underline-offset-2">
              admin impersonation → /sell
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={listingType} onValueChange={setListingType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All listing types</SelectItem>
              {PEER_LISTING_SECTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {PEER_LISTING_SECTION_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading sell funnel…
        </div>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-8 text-destructive">{error}</CardContent>
        </Card>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Publish attempts"
              value={fmt(summary.publishAttempts)}
              hint={`${fmt(summary.flowStarts)} flow starts in window`}
            />
            <StatTile
              label="Publish success rate"
              value={pct(summary.successRate)}
              hint={`${fmt(summary.publishSuccesses)} succeeded`}
              tone={
                summary.successRate != null && summary.successRate >= 60
                  ? "good"
                  : summary.successRate != null && summary.successRate < 40
                    ? "warn"
                    : "neutral"
              }
            />
            <StatTile
              label="Validation blocks"
              value={fmt(summary.validationFailures)}
              hint="Form rejected before publish"
              tone={summary.validationFailures > 0 ? "warn" : "neutral"}
            />
            <StatTile
              label="Unique sellers"
              value={fmt(summary.uniqueUsers)}
              hint={
                summary.medianDurationMs != null
                  ? `Median publish time ${Math.round(summary.medianDurationMs / 1000)}s`
                  : "Median publish time unavailable"
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step funnel</CardTitle>
                <CardDescription>
                  Sections viewed vs. marked complete (session-scoped step events).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stepRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No step events yet — deploy step tracking and revisit after sellers use `/sell`.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead className="text-right">Viewed</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Drop-off</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stepRows.map((row) => {
                        const dropOff =
                          row.viewed > 0
                            ? Math.max(0, Math.round(((row.viewed - row.completed) / row.viewed) * 100))
                            : null
                        return (
                          <TableRow key={row.step}>
                            <TableCell className="font-medium">
                              {sellFunnelStepLabel(row.step)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(row.viewed)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(row.completed)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {dropOff != null ? `${dropOff}%` : "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top validation failures</CardTitle>
                <CardDescription>Fields blocking publish — fix UX or copy here first.</CardDescription>
              </CardHeader>
              <CardContent>
                {!data?.topValidationFailures.length ? (
                  <p className="text-sm text-muted-foreground">No validation failures recorded.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topValidationFailures.map((row) => (
                        <TableRow key={`${row.field}:${row.message}`}>
                          <TableCell className="font-mono text-xs">{row.field}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                            {row.message || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(row.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By listing type</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.byListingType.length ? (
                  <p className="text-sm text-muted-foreground">No events in this window.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Starts</TableHead>
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byListingType.map((row) => (
                        <TableRow key={row.listingType}>
                          <TableCell>
                            {PEER_LISTING_SECTION_LABELS[
                              row.listingType as keyof typeof PEER_LISTING_SECTION_LABELS
                            ] ?? row.listingType}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(row.flowStarts)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.publishAttempts)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.publishSuccesses)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily publish trend</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.dailyTrend.length ? (
                  <p className="text-sm text-muted-foreground">No daily data.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date (UTC)</TableHead>
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Successes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...data.dailyTrend].slice(-14).map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.publishAttempts)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.publishSuccesses)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent events</CardTitle>
              <CardDescription>Latest raw funnel rows for debugging stuck sellers.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!data?.recentEvents.length ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentEvents.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDistanceToNow(parseISO(row.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.event}</TableCell>
                        <TableCell className="text-sm">{row.listingType}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs">
                          {row.field ? sellFunnelStepLabel(row.field) : row.message ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.userId ? (
                            <Link
                              href={`/admin/users/${row.userId}`}
                              className="text-primary underline underline-offset-2"
                            >
                              {row.userId.slice(0, 8)}…
                            </Link>
                          ) : (
                            "guest"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
              Upload failures: {fmt(summary.uploadFailures)}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-amber-600" aria-hidden />
              Server publish failures: {fmt(summary.publishFailures)}
            </span>
            <Link href="/admin/notifications" className="text-primary underline underline-offset-2">
              Klaviyo event log
            </Link>
          </div>
        </>
      ) : null}
    </div>
  )
}
