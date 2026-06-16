"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  MinusCircle,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type {
  KlaviyoMetricCategory,
  NotificationsCenterAnalytics,
  NotificationsCenterRange,
} from "@/lib/db/klaviyoEventLog"

const RANGES: { value: NotificationsCenterRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
]

const CATEGORY_STYLES: Record<KlaviyoMetricCategory, string> = {
  transactional: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  lifecycle: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  engagement: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  marketing: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  other: "bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  skipped: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  failed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%"
  return `${Math.round((part / whole) * 1000) / 10}%`
}

function safeFormat(value: string, pattern: string): string {
  try {
    return format(parseISO(value), pattern)
  } catch {
    return value
  }
}

interface KpiCardProps {
  title: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  accent?: string
}

function KpiCard({ title, value, hint, icon, accent }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className={cn("text-muted-foreground", accent)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function NotificationsCenterClient() {
  const [range, setRange] = useState<NotificationsCenterRange>("7d")
  const [data, setData] = useState<NotificationsCenterAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstLoadRef = useRef(false)
  const chartId = useId().replace(/:/g, "")

  const load = useCallback(
    async (nextRange: NotificationsCenterRange, opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !firstLoadRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)
      try {
        const res = await fetch(`/api/admin/notifications-center?range=${nextRange}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "Could not load analytics")
          return
        }
        setData(body as NotificationsCenterAnalytics)
      } catch {
        setError("Could not load analytics")
      } finally {
        if (firstEver) {
          setLoading(false)
          firstLoadRef.current = true
        } else if (!opts?.silent) {
          setRefreshing(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    void load(range)
  }, [range, load])

  const k = data?.klaviyo
  const internal = data?.internal
  const deliveryRate = k ? pct(k.totals.sent, k.totals.total) : "—"

  const timeline = useMemo(
    () =>
      (k?.timeline ?? []).map((p) => ({
        ...p,
        label: range === "24h" ? safeFormat(p.bucket, "ha") : safeFormat(p.bucket, "MMM d"),
      })),
    [k?.timeline, range],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BellRing className="h-8 w-8 text-neutral-800" />
            Notifications center
          </h1>
          <p className="text-muted-foreground mt-1">
            Klaviyo email flow analytics and in-app notification delivery. Every Klaviyo event we
            fire — sent, skipped, or failed — is logged here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(range, { silent: false })}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Klaviyo events"
              value={k?.totals.total ?? 0}
              hint={`${k?.totals.uniqueRecipients ?? 0} unique recipients`}
              icon={<Mail className="h-4 w-4" />}
            />
            <KpiCard
              title="Sent"
              value={k?.totals.sent ?? 0}
              hint={`${deliveryRate} delivery rate`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="text-emerald-600"
            />
            <KpiCard
              title="Skipped"
              value={k?.totals.skipped ?? 0}
              hint="Not sent (no profile / config / dedupe)"
              icon={<MinusCircle className="h-4 w-4" />}
              accent="text-amber-600"
            />
            <KpiCard
              title="Failed"
              value={k?.totals.failed ?? 0}
              hint="Klaviyo API errors"
              icon={<TriangleAlert className="h-4 w-4" />}
              accent="text-rose-600"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event volume</CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Sent vs skipped vs failed over the selected window.
              </p>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">No events in this window yet.</p>
                </div>
              ) : (
                <div className="h-[240px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <AreaChart data={timeline} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`sent-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`skip-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`fail-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sent"
                        stackId="1"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill={`url(#sent-${chartId})`}
                      />
                      <Area
                        type="monotone"
                        dataKey="skipped"
                        stackId="1"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        fill={`url(#skip-${chartId})`}
                      />
                      <Area
                        type="monotone"
                        dataKey="failed"
                        stackId="1"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        fill={`url(#fail-${chartId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="flows" className="space-y-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="flows">Email flows</TabsTrigger>
              <TabsTrigger value="skipped">Skipped</TabsTrigger>
              <TabsTrigger value="recipients">Recipients</TabsTrigger>
              <TabsTrigger value="internal">In-app</TabsTrigger>
              <TabsTrigger value="recent">Recent activity</TabsTrigger>
            </TabsList>

            <TabsContent value="flows">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Flows by metric</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    Each metric is what triggers a Klaviyo flow. Unique recipients ≈ profiles that
                    entered that flow.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(k?.byMetric.length ?? 0) === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Metric / flow</th>
                          <th className="pb-2 pr-4 font-medium">Category</th>
                          <th className="pb-2 pr-4 text-right font-medium">Recipients</th>
                          <th className="pb-2 pr-4 text-right font-medium">Sent</th>
                          <th className="pb-2 pr-4 text-right font-medium">Skipped</th>
                          <th className="pb-2 pr-4 text-right font-medium">Failed</th>
                          <th className="pb-2 text-right font-medium">Sent %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k!.byMetric.map((m) => (
                          <tr key={m.metric} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-4 font-medium">{m.metric}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="secondary" className={cn("capitalize", CATEGORY_STYLES[m.category])}>
                                {m.category}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">{m.uniqueRecipients}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{m.sent}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-amber-600">{m.skipped}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-rose-600">{m.failed}</td>
                            <td className="py-2 text-right tabular-nums">{pct(m.sent, m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skipped">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Why emails were skipped</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    Events we chose not to send to Klaviyo. The most common reason is a missing
                    profile identifier or a missing API key.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(k?.bySkipReason.length ?? 0) === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nothing skipped in this window.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Reason</th>
                          <th className="pb-2 text-right font-medium">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k!.bySkipReason.map((s) => (
                          <tr key={s.reason} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-4">{s.reason}</td>
                            <td className="py-2 text-right tabular-nums">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recipients">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top recipients</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    Who we are sending to most, and across how many distinct flows.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(k?.topRecipients.length ?? 0) === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No recipients yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Recipient</th>
                          <th className="pb-2 pr-4 text-right font-medium">Events</th>
                          <th className="pb-2 pr-4 text-right font-medium">Sent</th>
                          <th className="pb-2 text-right font-medium">Flows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k!.topRecipients.map((r) => (
                          <tr key={r.identifier} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-4">{r.email || r.identifier}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{r.count}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{r.sent}</td>
                            <td className="py-2 text-right tabular-nums">{r.metrics}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="internal">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    title="In-app notifications"
                    value={internal?.totals.total ?? 0}
                    hint={`${internal?.totals.uniqueUsers ?? 0} users`}
                    icon={<BellRing className="h-4 w-4" />}
                  />
                  <KpiCard
                    title="Read"
                    value={internal?.totals.read ?? 0}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    accent="text-emerald-600"
                  />
                  <KpiCard
                    title="Unread"
                    value={internal?.totals.unread ?? 0}
                    icon={<Users className="h-4 w-4" />}
                    accent="text-sky-600"
                  />
                  <KpiCard
                    title="Read rate"
                    value={internal ? pct(internal.totals.read, internal.totals.total) : "—"}
                    icon={<Mail className="h-4 w-4" />}
                  />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">In-app notifications by type</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {(internal?.byType.length ?? 0) === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No in-app notifications in this window.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Type</th>
                            <th className="pb-2 pr-4 text-right font-medium">Total</th>
                            <th className="pb-2 text-right font-medium">Read</th>
                          </tr>
                        </thead>
                        <tbody>
                          {internal!.byType.map((t) => (
                            <tr key={t.type} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-4 font-mono text-xs">{t.type}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{t.count}</td>
                              <td className="py-2 text-right tabular-nums">{t.read}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="recent">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Klaviyo events</CardTitle>
                  {data?.fetchedAt && (
                    <p className="text-xs text-muted-foreground font-normal">
                      Updated {formatDistanceToNow(new Date(data.fetchedAt), { addSuffix: true })}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(k?.recent.length ?? 0) === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No recent events.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Metric</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Recipient</th>
                          <th className="pb-2 pr-4 font-medium">Detail</th>
                          <th className="pb-2 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k!.recent.map((e) => (
                          <tr key={e.id} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-4 font-medium">{e.metric}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="secondary" className={cn("capitalize", STATUS_STYLES[e.status])}>
                                {e.status}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {e.email || e.externalId || "—"}
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">
                              {e.skipReason || (e.httpStatus ? `HTTP ${e.httpStatus}` : "—")}
                            </td>
                            <td className="py-2 whitespace-nowrap text-muted-foreground">
                              {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
