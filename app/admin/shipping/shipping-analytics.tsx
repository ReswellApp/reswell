"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip as RechartsTooltip, XAxis } from "recharts"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { AdminShippingStats } from "@/lib/services/adminShippingStats"

const SOURCE_LABEL: Record<string, string> = {
  shipengine_checkout_lane: "ShipEngine (checkout)",
  manual_label_upload: "Manual PDF",
  manual_tracking_buyer: "Manual tracking",
}

const SOURCE_COLOR: Record<string, string> = {
  shipengine_checkout_lane: "#0d9488",
  manual_label_upload: "#6366f1",
  manual_tracking_buyer: "#f59e0b",
}

const STAGE_LABEL: Record<string, string> = {
  shipengine_not_configured: "Not configured",
  incomplete_address: "Incomplete address",
  rate_quote: "Rate quote failed",
  rate_id: "No rate ID",
  label_purchase: "Purchase failed",
  attach_label: "Attach failed",
}

function usd(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function ShippingAnalytics({
  stats,
  onRefresh,
}: {
  stats: AdminShippingStats | null
  onRefresh: () => Promise<void> | void
}) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const sourceData = useMemo(() => {
    if (!stats) return []
    return (Object.keys(stats.sourceCounts) as Array<keyof typeof stats.sourceCounts>)
      .map((key) => ({
        key,
        name: SOURCE_LABEL[key] ?? key,
        value: stats.sourceCounts[key],
        color: SOURCE_COLOR[key] ?? "#94a3b8",
      }))
      .filter((d) => d.value > 0)
  }, [stats])

  const failureData = useMemo(() => {
    if (!stats) return []
    return (Object.keys(stats.failureStageCounts) as Array<keyof typeof stats.failureStageCounts>)
      .map((key) => ({ key, name: STAGE_LABEL[key] ?? key, value: stats.failureStageCounts[key] }))
      .filter((d) => d.value > 0)
  }, [stats])

  const seriesData = useMemo(
    () =>
      (stats?.dailySeries ?? []).map((d) => ({
        date: d.date.slice(5),
        count: d.count,
        spendUsd: d.spendUsd,
      })),
    [stats],
  )

  if (!stats) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        Crunching shipping analytics…
      </div>
    )
  }

  const failureTotal = failureData.reduce((sum, d) => sum + d.value, 0)
  const marginPositive = stats.cost.marginUsd >= 0
  const carrierMax = Math.max(1, ...stats.carrierCounts.map((x) => x.count))
  const failureMax = Math.max(1, ...failureData.map((x) => x.value))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Volume, carrier mix, and spend over the last {stats.windowDays} days, plus the open-failure funnel and
          buyer-paid vs carrier-cost reconciliation.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">Labels per day</CardTitle>
          <CardDescription className="text-sm">Last {stats.windowDays} days</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {seriesData.every((d) => d.count === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No labels in this window yet.</p>
          ) : (
            <ChartContainer config={{ count: { label: "Labels", color: "#0d9488" } }} className="h-[220px] w-full">
              <BarChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  fontSize={11}
                />
                <RechartsTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null
                    const row = payload[0].payload as { count: number; spendUsd: number }
                    return (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                        <p className="font-medium">{label}</p>
                        <p className="tabular-nums text-muted-foreground">{row.count} labels</p>
                        {row.spendUsd > 0 ? (
                          <p className="tabular-nums text-muted-foreground">{usd(row.spendUsd)} spend</p>
                        ) : null}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">Label source</CardTitle>
            <CardDescription className="text-sm">How labels were created (30d)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-2">
            {sourceData.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">No labels yet.</p>
            ) : (
              <>
                <ChartContainer config={{ value: { label: "Labels" } }} className="aspect-square h-[170px] w-full">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius="80%"
                      paddingAngle={2}
                    >
                      {sourceData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} stroke="var(--background)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null
                        const row = payload[0].payload as { name: string; value: number }
                        return (
                          <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                            <p className="font-medium">{row.name}</p>
                            <p className="tabular-nums text-muted-foreground">{row.value} labels</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ChartContainer>
                <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {sourceData.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="truncate text-muted-foreground">{entry.name}</span>
                      <span className="ml-auto font-semibold tabular-nums">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">Top carriers</CardTitle>
            <CardDescription className="text-sm">By label volume (30d)</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {stats.carrierCounts.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">No carrier data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.carrierCounts.map((c) => {
                  const width = Math.max(c.count > 0 ? 6 : 0, Math.round((c.count / carrierMax) * 100))
                  return (
                    <div key={c.carrier} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs font-medium text-muted-foreground">
                        {c.carrier}
                      </span>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/50">
                        <div
                          className="h-full rounded-md bg-sky-500/80 transition-all"
                          style={{ width: `${width}%` }}
                        />
                        <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold tabular-nums text-foreground/80">
                          {c.count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">Open failure funnel</CardTitle>
            <CardDescription className="text-sm">Where automated purchases break</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {failureTotal === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">No open failures — all clear.</p>
            ) : (
              <div className="space-y-2.5">
                {failureData.map((d) => {
                  const width = Math.max(d.value > 0 ? 6 : 0, Math.round((d.value / failureMax) * 100))
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs font-medium text-muted-foreground">
                        {d.name}
                      </span>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/50">
                        <div
                          className="h-full rounded-md bg-rose-500/70 transition-all"
                          style={{ width: `${width}%` }}
                        />
                        <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold tabular-nums text-foreground/80">
                          {d.value}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">Cost reconciliation</CardTitle>
            <CardDescription className="text-sm">
              Buyer-paid shipping vs carrier label cost across orders with a recorded cost (30d)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">Buyer paid</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{usd(stats.cost.buyerPaidTotalUsd)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">Carrier cost</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{usd(stats.cost.totalLabelSpendUsd)}</p>
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                marginPositive
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-rose-500/30 bg-rose-500/5",
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">Net margin</p>
              <p
                className={cn(
                  "mt-1 text-3xl font-bold tabular-nums",
                  marginPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {usd(stats.cost.marginUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {stats.cost.reconciledOrders} reconciled order
                {stats.cost.reconciledOrders === 1 ? "" : "s"}. Manual uploads and labels bought before cost
                tracking are excluded.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
