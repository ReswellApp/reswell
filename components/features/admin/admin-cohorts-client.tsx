"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AdminPageHeader } from "@/components/features/admin/admin-page-header"
import { AdminStatStrip } from "@/components/features/admin/admin-stat-strip"
import { Button } from "@/components/ui/button"
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
import type { AdminCohortsDashboard } from "@/lib/types/adminCohorts"
import { cn } from "@/lib/utils"

type ViewMode = "retention" | "frequency"

const COHORT_MONTH_OPTIONS = [
  { value: "6", label: "Last 6 cohorts" },
  { value: "12", label: "Last 12 cohorts" },
  { value: "18", label: "Last 18 cohorts" },
  { value: "24", label: "Last 24 cohorts" },
] as const

function fmt(n: number): string {
  return n.toLocaleString()
}

function pct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—"
  return `${(rate * 100).toFixed(1)}%`
}

function formatCohortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function retentionFill(rate: number | null, elapsed: boolean): string {
  if (!elapsed || rate == null) return "transparent"
  const clamped = Math.max(0, Math.min(1, rate))
  // Teal scale aligned with admin chrome — stronger = higher retention.
  const alpha = 0.08 + clamped * 0.72
  return `hsla(174, 42%, 32%, ${alpha.toFixed(3)})`
}

export function AdminCohortsClient() {
  const [cohortMonths, setCohortMonths] = useState("12")
  const [view, setView] = useState<ViewMode>("retention")
  const [data, setData] = useState<AdminCohortsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !initialAttemptDoneRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)

      try {
        const params = new URLSearchParams({
          cohortMonths,
          horizonMonths: "6",
        })
        const res = await fetch(`/api/admin/cohorts?${params}`, {
          credentials: "include",
        })
        const body = (await res.json().catch(() => ({}))) as {
          data?: AdminCohortsDashboard
          error?: string
        }
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "Could not load cohorts.")
          setData(null)
          return
        }
        if (body.data && typeof body.data === "object") {
          setData(body.data)
        } else {
          setError("Invalid response from server")
          setData(null)
        }
      } catch {
        setError("Could not load cohorts.")
        setData(null)
      } finally {
        if (firstEver) {
          setLoading(false)
          initialAttemptDoneRef.current = true
        } else {
          setRefreshing(false)
        }
      }
    },
    [cohortMonths],
  )

  useEffect(() => {
    void load()
  }, [load])

  const horizon = data?.horizonMonths ?? 6
  const offsets = useMemo(
    () => Array.from({ length: horizon }, (_, i) => i),
    [horizon],
  )

  const frequencyChartData = useMemo(() => {
    if (!data) return []
    const totals = new Map<number, number>()
    for (let i = 0; i < horizon; i++) totals.set(i, 0)
    for (const cohort of data.cohorts) {
      for (const bucket of cohort.returnFrequency) {
        totals.set(bucket.returns, (totals.get(bucket.returns) ?? 0) + bucket.users)
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([returns, users]) => ({
        label: returns === 0 ? "0 returns" : returns === 1 ? "1 month" : `${returns} months`,
        returns,
        users,
      }))
  }, [data, horizon])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cohorts"
        description="Users grouped by signup month (Pacific). Retention shows who came back each month; return frequency counts how many distinct months they returned in the next six."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cohortMonths} onValueChange={setCohortMonths}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cohorts" />
              </SelectTrigger>
              <SelectContent>
                {COHORT_MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retention">By month</SelectItem>
                <SelectItem value="frequency">Return frequency</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void load({ silent: true })}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cohorts…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <AdminStatStrip
            items={[
              {
                label: "Users in window",
                value: fmt(data.summary.totalUsers),
                footnote: `${data.cohortMonths} signup months`,
              },
              {
                label: "Returned at least once",
                value: pct(data.summary.returnedRate),
                footnote: `${fmt(data.summary.returnedUsers)} users`,
              },
              {
                label: "Month-1 retention",
                value: pct(data.summary.m1RetentionRate),
                footnote: "Among cohorts that reached M1",
              },
              {
                label: "Avg return months",
                value:
                  data.summary.avgReturnMonths == null
                    ? "—"
                    : data.summary.avgReturnMonths.toFixed(2),
                footnote: "Distinct months after signup",
              },
            ]}
          />

          <p className="text-xs text-muted-foreground">{data.activityDefinition}</p>

          {view === "retention" ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[120px] bg-background">
                      Cohort
                    </TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    {offsets.map((offset) => (
                      <TableHead key={offset} className="text-center tabular-nums">
                        {offset === 0 ? "M0" : `M${offset}`}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cohorts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2 + offsets.length} className="text-muted-foreground">
                        No signups in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cohorts.map((cohort) => (
                      <TableRow key={cohort.cohortMonth}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {formatCohortMonth(cohort.cohortMonth)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(cohort.size)}
                        </TableCell>
                        {offsets.map((offset) => {
                          const cell = cohort.retention.find((c) => c.offset === offset)
                          const rate = cell?.rate ?? null
                          const elapsed = cell?.elapsed ?? false
                          const users = cell?.users ?? 0
                          return (
                            <TableCell
                              key={offset}
                              className={cn(
                                "text-center tabular-nums",
                                !elapsed && "text-muted-foreground/50",
                              )}
                              style={{ backgroundColor: retentionFill(rate, elapsed) }}
                              title={
                                elapsed
                                  ? `${fmt(users)} users (${pct(rate)})`
                                  : "Month not yet reached"
                              }
                            >
                              {elapsed ? pct(rate) : "—"}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="h-72 w-full rounded-md border p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number | string) => [
                        typeof value === "number" ? fmt(value) : String(value),
                        "Users",
                      ]}
                    />
                    <Bar dataKey="users" fill="hsl(174 42% 32%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 min-w-[120px] bg-background">
                        Cohort
                      </TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Returned</TableHead>
                      <TableHead className="text-right">Avg months</TableHead>
                      {offsets.map((returns) => (
                        <TableHead key={returns} className="text-center tabular-nums">
                          {returns === 0 ? "0" : `${returns}×`}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.cohorts.map((cohort) => (
                      <TableRow key={cohort.cohortMonth}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {formatCohortMonth(cohort.cohortMonth)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(cohort.size)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pct(
                            cohort.size > 0 ? cohort.returnedUsers / cohort.size : null,
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cohort.avgReturnMonths.toFixed(2)}
                        </TableCell>
                        {offsets.map((returns) => {
                          const bucket = cohort.returnFrequency.find(
                            (b) => b.returns === returns,
                          )
                          const users = bucket?.users ?? 0
                          const share = cohort.size > 0 ? users / cohort.size : 0
                          return (
                            <TableCell
                              key={returns}
                              className="text-center tabular-nums"
                              style={{ backgroundColor: retentionFill(share, true) }}
                              title={`${fmt(users)} users`}
                            >
                              {fmt(users)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
