"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState, useTransition } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  Bot,
  DollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { LlmUsageDashboard, LlmUsageRangeDays } from "@/lib/services/llmUsageDashboard"

const RANGE_OPTIONS: { value: LlmUsageRangeDays; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
]

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
} as const

function formatUsd(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value === 0) return "$0"
  if (Math.abs(value) < 0.01) return `$${value.toFixed(6)}`
  if (Math.abs(value) < 1) return `$${value.toFixed(digits)}`
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString("en-US")
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function transportLabel(transport: string): string {
  if (transport === "vercel_ai_gateway") return "Vercel AI Gateway"
  if (transport === "anthropic_direct") return "Anthropic (direct)"
  return transport
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  label: string
  value: string
  subtitle?: string
  icon: ReactNode
  accent: "primary" | "teal" | "amber" | "violet" | "rose"
}) {
  const accentBar = {
    primary: "bg-blue-600",
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
  } as const
  const iconTint = {
    primary: "bg-blue-50 text-blue-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  } as const

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("absolute inset-y-0 left-0 w-1", accentBar[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconTint[accent],
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  )
}

function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </div>
  )
}

export function LlmUsageAdminClient() {
  const [days, setDays] = useState<LlmUsageRangeDays>(30)
  const [data, setData] = useState<LlmUsageDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback((range: LlmUsageRangeDays) => {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch(`/api/admin/llm-usage?days=${range}`, { cache: "no-store" })
        const json = (await res.json()) as { data?: LlmUsageDashboard; error?: string }
        if (!res.ok || !json.data) {
          setError(json.error ?? "Could not load LLM usage")
          setData(null)
          return
        }
        setData(json.data)
      } catch {
        setError("Could not load LLM usage")
        setData(null)
      }
    })
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">LLM usage</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Models Reswell calls, what each one is for, and spend through the Vercel AI Gateway.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v) as LlmUsageRangeDays)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => load(days)}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a
              href="https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway&title=AI%20Gateway"
              target="_blank"
              rel="noreferrer"
            >
              Gateway dashboard
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {!data && pending ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading LLM usage…
        </div>
      ) : null}

      {data ? (
        <>
          {data.gatewayError ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{data.gatewayError}</p>
            </div>
          ) : null}

          {!data.gatewayConfigured ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                AI Gateway is not configured in this environment. Feature inventory below still
                reflects what the app is wired to use.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Gateway spend"
              value={formatUsd(data.totals.totalCostUsd, 4)}
              subtitle={`${data.startDate} → ${data.endDate}`}
              icon={<DollarSign className="h-4 w-4" />}
              accent="primary"
            />
            <KpiCard
              label="Credit balance"
              value={formatUsd(data.credits.balanceUsd, 2)}
              subtitle={
                data.credits.totalUsedUsd != null
                  ? `${formatUsd(data.credits.totalUsedUsd, 2)} lifetime used`
                  : "AI Gateway credits"
              }
              icon={<Zap className="h-4 w-4" />}
              accent="teal"
            />
            <KpiCard
              label="Requests"
              value={data.totals.requestCount.toLocaleString("en-US")}
              subtitle={`${formatTokens(data.totals.inputTokens)} in · ${formatTokens(data.totals.outputTokens)} out`}
              icon={<Sparkles className="h-4 w-4" />}
              accent="violet"
            />
            <KpiCard
              label="App features"
              value={String(data.features.length)}
              subtitle={`${data.features.filter((f) => f.enabled).length} enabled`}
              icon={<Bot className="h-4 w-4" />}
              accent="amber"
            />
          </div>

          <SectionCard>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Models & features in the app</h3>
              <p className="mt-1 text-xs text-slate-500">
                Source of truth for what Reswell calls, independent of Gateway traffic in the
                selected range.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Feature</th>
                    <th className="pb-2 pr-3 font-medium">Model</th>
                    <th className="pb-2 pr-3 font-medium">Transport</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Range spend</th>
                    <th className="pb-2 font-medium">Where</th>
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((feature) => (
                    <tr key={feature.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-900">{feature.name}</p>
                        <p className="mt-1 max-w-sm text-xs text-slate-500">{feature.purpose}</p>
                        {feature.gatewayFeatureTag ? (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Tag className="h-3 w-3" />
                            {feature.gatewayFeatureTag}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-800">{feature.model}</td>
                      <td className="py-3 pr-3 text-xs text-slate-600">
                        {transportLabel(feature.transport)}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            feature.enabled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          {feature.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-xs text-slate-700">
                        {feature.rangeCostUsd == null
                          ? "Not via Gateway"
                          : `${formatUsd(feature.rangeCostUsd)} · ${feature.rangeRequestCount?.toLocaleString("en-US") ?? 0} req`}
                      </td>
                      <td className="py-3">
                        <ul className="space-y-0.5 text-xs text-slate-500">
                          {feature.surfaces.map((surface) => (
                            <li key={surface}>{surface}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Daily Gateway spend</h3>
                <p className="mt-1 text-xs text-slate-500">Charged cost by UTC day.</p>
              </div>
              {data.byDay.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No Gateway spend in range.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.byDay}>
                      <defs>
                        <linearGradient id="llmSpendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={formatDateLabel}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v: number) => formatUsd(v, 2)}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                      />
                      <RechartsTooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(value) => [
                          formatUsd(typeof value === "number" ? value : Number(value)),
                          "Spend",
                        ]}
                        labelFormatter={(label) => formatDateLabel(String(label))}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalCostUsd"
                        stroke="#2563eb"
                        fill="url(#llmSpendFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Spend by model</h3>
                <p className="mt-1 text-xs text-slate-500">Top models through AI Gateway.</p>
              </div>
              {data.byModel.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No model spend in range.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.byModel.slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 8, right: 12 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => formatUsd(v, 2)}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="key"
                        width={140}
                        tick={{ fontSize: 10, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(value) => [
                          formatUsd(typeof value === "number" ? value : Number(value)),
                          "Spend",
                        ]}
                      />
                      <Bar dataKey="totalCostUsd" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Spend by provider</h3>
              </div>
              {data.byProvider.length === 0 ? (
                <p className="text-sm text-slate-500">No provider spend in range.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.byProvider.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="font-medium text-slate-800">{row.key}</span>
                      <span className="tabular-nums text-slate-600">
                        {formatUsd(row.totalCostUsd)} · {row.requestCount.toLocaleString("en-US")}{" "}
                        req
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Spend by Gateway tag</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Feature tags appear after tagged requests land in Custom Reporting.
                </p>
              </div>
              {data.byFeatureTag.length === 0 ? (
                <p className="text-sm text-slate-500">No tagged spend in range yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.byFeatureTag.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="font-mono text-xs text-slate-800">{row.key}</span>
                      <span className="tabular-nums text-slate-600">
                        {formatUsd(row.totalCostUsd)} · {row.requestCount.toLocaleString("en-US")}{" "}
                        req
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Gateway models in use</h3>
              <p className="mt-1 text-xs text-slate-500">
                Pricing from AI Gateway model catalog, paired with spend in the selected range.
              </p>
            </div>
            {data.gatewayModels.length === 0 ? (
              <p className="text-sm text-slate-500">No Gateway models to show yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-3 font-medium">Model</th>
                      <th className="pb-2 pr-3 font-medium">Input / 1M</th>
                      <th className="pb-2 pr-3 font-medium">Output / 1M</th>
                      <th className="pb-2 pr-3 font-medium">Range spend</th>
                      <th className="pb-2 font-medium">In app</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.gatewayModels.map((model) => (
                      <tr key={model.id} className="border-b border-slate-100">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-slate-900">{model.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{model.id}</p>
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-xs text-slate-700">
                          {model.pricingInputPerMillion == null
                            ? "—"
                            : formatUsd(model.pricingInputPerMillion, 2)}
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-xs text-slate-700">
                          {model.pricingOutputPerMillion == null
                            ? "—"
                            : formatUsd(model.pricingOutputPerMillion, 2)}
                        </td>
                        <td className="py-3 pr-3 tabular-nums text-xs text-slate-700">
                          {formatUsd(model.rangeCostUsd)} ·{" "}
                          {model.rangeRequestCount.toLocaleString("en-US")} req
                        </td>
                        <td className="py-3 text-xs text-slate-600">
                          {model.usedByApp ? "Yes" : "Traffic only"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {data.notes.length > 0 ? (
            <ul className="space-y-1 text-xs text-slate-500">
              {data.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
