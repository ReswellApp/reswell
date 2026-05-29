"use client"

import { useMemo } from "react"
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip as RechartsTooltip, XAxis } from "recharts"
import { Activity } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  CHANNEL_COLOR,
  CHANNEL_LABEL,
  STATUS_BAR_CLASS,
  STATUS_LABEL,
  STATUS_LIST,
} from "@/components/features/admin/contact-messages-labels"
import {
  formatResolutionDuration,
  type ContactMessagesStats,
} from "@/components/features/admin/contact-messages-stats"
import type { ContactMessageSource } from "@/lib/db/contactMessages"

export function ContactMessagesAnalytics({ stats }: { stats: ContactMessagesStats }) {
  const funnelMax = useMemo(
    () => Math.max(1, ...STATUS_LIST.map((s) => stats.statusCounts[s])),
    [stats.statusCounts],
  )

  const channelData = useMemo(
    () =>
      (Object.keys(stats.channelCounts) as ContactMessageSource[])
        .map((key) => ({
          key,
          name: CHANNEL_LABEL[key],
          value: stats.channelCounts[key],
          color: CHANNEL_COLOR[key],
        }))
        .filter((d) => d.value > 0),
    [stats.channelCounts],
  )

  const seriesData = useMemo(
    () => stats.dailySeries.map((d) => ({ date: d.date.slice(5), count: d.count })),
    [stats.dailySeries],
  )

  const hasVolume = seriesData.some((d) => d.count > 0)

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-teal-600" />
          Inbox insights
        </CardTitle>
        <CardDescription>Live snapshot of volume, workflow stages, and channel mix</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-gradient-to-br from-teal-500/10 to-sky-500/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">Resolution rate</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{stats.resolutionRate}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.resolved} of {stats.total} resolved
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium text-muted-foreground">Avg. resolution</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatResolutionDuration(stats.avgResolutionHours)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Open to resolved</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium text-muted-foreground">Linked threads</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{stats.linkedThreads}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">In-app conversations</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Workflow stages</p>
            <div className="space-y-2">
              {STATUS_LIST.map((stage) => {
                const count = stats.statusCounts[stage]
                const width = Math.max(count > 0 ? 8 : 0, Math.round((count / funnelMax) * 100))
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
                      {STATUS_LABEL[stage]}
                    </span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/50">
                      <div
                        className={cn("h-full rounded-md transition-all", STATUS_BAR_CLASS[stage])}
                        style={{ width: `${width}%` }}
                      />
                      <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold tabular-nums text-foreground/80">
                        {count}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tickets per day · last 14 days</p>
            {hasVolume ? (
              <ChartContainer
                config={{ count: { label: "Tickets", color: "#0d9488" } }}
                className="h-[140px] w-full"
              >
                <BarChart data={seriesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                      const row = payload[0].payload as { count: number }
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium">{label}</p>
                          <p className="tabular-nums text-muted-foreground">{row.count} tickets</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No tickets in this window yet.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 p-4">
          <p className="self-start text-xs font-medium text-muted-foreground">Channel mix</p>
          {channelData.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No tickets yet</p>
          ) : (
            <>
              <ChartContainer config={{ value: { label: "Tickets" } }} className="aspect-square h-[150px] w-full">
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {channelData.map((entry) => (
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
                          <p className="tabular-nums text-muted-foreground">{row.value} tickets</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ChartContainer>
              <ul className="grid w-full grid-cols-1 gap-2">
                {channelData.map((entry) => (
                  <li key={entry.key} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto font-semibold tabular-nums">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
