"use client"

import { useMemo } from "react"
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from "recharts"
import { ArrowRight, TrendingUp } from "lucide-react"
import type { CrmContactStatus, CrmStats } from "@/lib/db/crm"
import { CRM_SOURCE_LABEL, CRM_STATUS_LABEL, formatCurrency } from "@/components/features/admin/crm/crm-labels"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const FUNNEL_STAGES: CrmContactStatus[] = ["lead", "prospect", "active", "customer"]

const STATUS_BAR_CLASS: Record<CrmContactStatus, string> = {
  lead: "bg-sky-500",
  prospect: "bg-violet-500",
  active: "bg-emerald-500",
  customer: "bg-teal-500",
  inactive: "bg-muted-foreground/40",
}

const SOURCE_COLORS = {
  profile: "#0d9488",
  external: "#6366f1",
} as const

export function CrmAnalytics({ stats }: { stats: CrmStats }) {
  const funnelMax = useMemo(
    () => Math.max(1, ...FUNNEL_STAGES.map((stage) => stats.statusCounts[stage])),
    [stats.statusCounts],
  )

  const conversionRate = useMemo(() => {
    if (stats.totalContacts === 0) return 0
    return Math.round((stats.statusCounts.customer / stats.totalContacts) * 100)
  }, [stats.statusCounts.customer, stats.totalContacts])

  const sourceData = useMemo(
    () =>
      (Object.keys(stats.sourceCounts) as Array<keyof typeof stats.sourceCounts>)
        .map((key) => ({
          key,
          name: CRM_SOURCE_LABEL[key],
          value: stats.sourceCounts[key],
          color: SOURCE_COLORS[key],
        }))
        .filter((entry) => entry.value > 0),
    [stats.sourceCounts],
  )

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-teal-600" />
          Pipeline insights
        </CardTitle>
        <CardDescription>Live snapshot of pipeline value, stages, and lead sources</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-gradient-to-br from-teal-500/10 to-sky-500/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">Pipeline value</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(stats.pipelineValue)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.activeInterests} active interest{stats.activeInterests === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium text-muted-foreground">Conversion</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{conversionRate}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Contacts won as customers</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium text-muted-foreground">Avg. deal size</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(
                  stats.activeInterests > 0 ? Math.round(stats.pipelineValue / stats.activeInterests) : 0,
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Per active interest</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Stage funnel</p>
            <div className="space-y-2">
              {FUNNEL_STAGES.map((stage) => {
                const count = stats.statusCounts[stage]
                const width = Math.max(count > 0 ? 8 : 0, Math.round((count / funnelMax) * 100))
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                      {CRM_STATUS_LABEL[stage]}
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
            {stats.statusCounts.inactive > 0 ? (
              <p className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                {stats.statusCounts.inactive} inactive contact
                {stats.statusCounts.inactive === 1 ? "" : "s"} excluded from funnel
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 p-4">
          <p className="self-start text-xs font-medium text-muted-foreground">Lead source</p>
          {sourceData.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No contacts yet</p>
          ) : (
            <>
              <ChartContainer config={{ value: { label: "Contacts" } }} className="aspect-square h-[150px] w-full">
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
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
                          <p className="tabular-nums text-muted-foreground">{row.value} contacts</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ChartContainer>
              <ul className="grid w-full grid-cols-2 gap-2">
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
        </div>
      </CardContent>
    </Card>
  )
}
