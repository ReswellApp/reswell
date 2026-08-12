"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Users,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SearchDailyReportRow } from "@/lib/services/searchDailyReport"
import type { SearchDailyLlmReport } from "@/lib/validations/search-daily-report"

type RecentRow = {
  date: string
  status: SearchDailyReportRow["status"]
  generatedAt: string
  totalSearches: number
  zeroResultEventCount: number
}

type DashboardPayload = {
  date: string
  defaultDate: string
  todayPacific: string
  report: SearchDailyReportRow | null
  recent: RecentRow[]
}

const OWNER_LABEL: Record<string, string> = {
  inventory: "Inventory",
  search: "Search",
  sellers: "Sellers",
  buyers: "Buyers",
  ops: "Ops",
}

const CAUSE_LABEL: Record<string, string> = {
  no_inventory: "No inventory",
  synonym_gap: "Synonym gap",
  typo_or_spelling: "Typo / spelling",
  wrong_category: "Wrong category",
  nl_parse_miss: "NL parse miss",
  unknown: "Unknown",
}

const PRIORITY_TINT: Record<string, string> = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-slate-100 text-slate-600",
}

function formatDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${Math.round(n * 1000) / 10}%`
}

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
          {icon}
        </span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

function ActionList({
  items,
}: {
  items: { finding: string; action: string }[]
}) {
  if (items.length === 0) return <EmptyHint>Nothing flagged for this day.</EmptyHint>
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.finding} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-900">{item.finding}</p>
          <p className="mt-1 text-sm text-slate-600">{item.action}</p>
        </li>
      ))}
    </ul>
  )
}

function ReportBody({ report }: { report: SearchDailyLlmReport }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Executive summary
        </h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {report.executiveSummary}
        </p>
      </section>

      {report.topActions.length > 0 ? (
        <SectionCard title="Top actions" icon={<ClipboardList className="h-4 w-4" />}>
          <ol className="space-y-3">
            {report.topActions.map((a, i) => (
              <li key={a.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{a.why}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {OWNER_LABEL[a.owner] ?? a.owner} · {a.effort} effort
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}

      {report.emptySearchFixes.length > 0 ? (
        <SectionCard title="Empty / no-result searches" icon={<Search className="h-4 w-4" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Query</th>
                  <th className="py-2 pr-3 font-medium">Count</th>
                  <th className="py-2 pr-3 font-medium">Cause</th>
                  <th className="py-2 pr-3 font-medium">Inventory</th>
                  <th className="py-2 font-medium">Search</th>
                </tr>
              </thead>
              <tbody>
                {report.emptySearchFixes.map((row) => (
                  <tr key={`${row.query}-${row.searchCount}`} className="border-b border-slate-100 align-top">
                    <td className="py-2.5 pr-3 font-medium text-slate-900">“{row.query}”</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-700">{row.searchCount}</td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {CAUSE_LABEL[row.likelyCause] ?? row.likelyCause}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{row.inventoryAction}</td>
                    <td className="py-2.5 text-slate-600">{row.searchAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {report.inventoryOpportunities.length > 0 ? (
        <SectionCard title="Inventory to source" icon={<Package className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.inventoryOpportunities.map((item) => (
              <li
                key={item.item}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.item}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      PRIORITY_TINT[item.priority] ?? PRIORITY_TINT.low,
                    )}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.demandSignal}</p>
                <p className="mt-1 text-sm text-slate-700">{item.sellerPlay}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {report.demandThemes.length > 0 ? (
        <SectionCard title="Demand themes" icon={<Wand2 className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.demandThemes.map((t) => (
              <li key={t.theme} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-sm font-medium text-slate-900">{t.theme}</p>
                <p className="mt-1 text-sm text-slate-600">{t.buyerIntent}</p>
                <p className="mt-1 text-xs text-slate-500">{t.evidence}</p>
                <p className="mt-2 text-sm text-slate-700">{t.recommendation}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Dropdown / typeahead" icon={<ArrowRight className="h-4 w-4" />}>
          <ActionList items={report.dropdownInsights} />
        </SectionCard>
        <SectionCard title="Search quality" icon={<Search className="h-4 w-4" />}>
          <ActionList items={report.searchQuality} />
        </SectionCard>
        <SectionCard title="Seller opportunities" icon={<Store className="h-4 w-4" />}>
          <ActionList items={report.sellerOpportunities} />
        </SectionCard>
        <SectionCard title="Buyer experience" icon={<Users className="h-4 w-4" />}>
          <ActionList items={report.buyerExperience} />
        </SectionCard>
      </div>

      {report.recurringFromPriorDays.length > 0 ? (
        <SectionCard title="Recurring from prior days" icon={<RefreshCw className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.recurringFromPriorDays.map((r) => (
              <li key={r.theme} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-sm font-medium text-slate-900">{r.theme}</p>
                <p className="mt-0.5 text-xs text-slate-500">Seen across {r.daysSeen} days</p>
                <p className="mt-1 text-sm text-slate-600">{r.nextStep}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  )
}

export function SearchDailyReportAdminClient() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [generating, setGenerating] = useState(false)

  const load = useCallback((date?: string) => {
    startTransition(async () => {
      setError(null)
      try {
        const qs = date ? `?date=${encodeURIComponent(date)}` : ""
        const res = await fetch(`/api/admin/search-daily-report${qs}`, { cache: "no-store" })
        const json = (await res.json()) as { data?: DashboardPayload; error?: string }
        if (!res.ok) {
          setError(json.error ?? "Could not load daily report")
          return
        }
        if (!json.data) {
          setError("Empty response")
          return
        }
        setPayload(json.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load daily report")
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const generate = useCallback(
    async (date: string, force: boolean) => {
      setGenerating(true)
      setError(null)
      try {
        const res = await fetch("/api/admin/search-daily-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, force }),
        })
        const json = (await res.json()) as {
          data?: { date: string; status: string; row: SearchDailyReportRow | null }
          error?: string
        }
        if (!res.ok) {
          setError(json.error ?? "Could not generate report")
          return
        }
        await load(json.data?.date ?? date)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate report")
      } finally {
        setGenerating(false)
      }
    },
    [load],
  )

  const row = payload?.report ?? null
  const activeDate = payload?.date ?? payload?.defaultDate ?? ""
  const snapshot = row?.snapshot
  const busy = pending || generating

  return (
    <div className="min-h-[60vh] w-full max-w-[1100px] space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Gemini 2.5 · Pacific day
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Search daily report</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Each morning Gemini reads that day’s searches, dropdown clicks, and empty-result
              queries, then recommends inventory, search, and marketplace moves.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              <Link href="/admin/search-analytics" className="underline underline-offset-2">
                Open search analytics
              </Link>
              {" · "}
              Cron runs at 14:30 UTC for the previous Pacific day.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Report date
              <input
                type="date"
                className="mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 sm:w-[180px]"
                value={activeDate}
                max={payload?.todayPacific}
                onChange={(e) => {
                  const next = e.target.value
                  if (next) void load(next)
                }}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={busy || !activeDate}
                onClick={() => activeDate && void load(activeDate)}
              >
                {pending && !generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Reload</span>
              </Button>
              <Button
                size="sm"
                className="h-9"
                disabled={busy || !activeDate}
                onClick={() => activeDate && void generate(activeDate, true)}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-2">{row ? "Regenerate" : "Generate"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}

      {busy && !row ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {generating ? "Gemini is reading yesterday’s searches…" : "Loading daily report…"}
        </div>
      ) : null}

      {row?.status === "failed" ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Report did not complete</p>
            <p className="mt-1">{row.error ?? "Unknown error"}</p>
          </div>
        </div>
      ) : null}

      {snapshot ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Searches"
            value={snapshot.totalSearches.toLocaleString()}
            subtitle={`${snapshot.uniqueQueriesApprox.toLocaleString()} unique queries`}
          />
          <KpiCard
            label="Empty results"
            value={snapshot.zeroResultEventCount.toLocaleString()}
            subtitle={pct(snapshot.zeroResultShare)}
          />
          <KpiCard
            label="Dropdown clicks"
            value={snapshot.dropdownClicks.toLocaleString()}
            subtitle={`${snapshot.navFreeFormSubmits.toLocaleString()} nav submits`}
          />
          <KpiCard
            label="Demand capture"
            value={snapshot.demandCaptureTotal.toLocaleString()}
            subtitle="Notify-me requests"
          />
        </div>
      ) : null}

      {row?.report ? <ReportBody report={row.report} /> : null}

      {!busy && payload && !row ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No report for {formatDateLabel(activeDate)}</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate one from this day’s logged searches, dropdown picks, and empty results.
          </p>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => activeDate && void generate(activeDate, true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with Gemini
          </Button>
        </div>
      ) : null}

      {payload?.recent && payload.recent.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Recent reports</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {payload.recent.map((r) => (
              <li key={r.date}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm",
                    r.date === activeDate ? "text-slate-900" : "text-slate-600 hover:text-slate-900",
                  )}
                  onClick={() => void load(r.date)}
                >
                  <span className="font-medium">{formatDateLabel(r.date)}</span>
                  <span className="text-xs text-slate-500">
                    {r.totalSearches.toLocaleString()} searches · {r.zeroResultEventCount} empty ·{" "}
                    {r.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {generating && row ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Regenerating with Gemini — this can take up to a minute.
        </p>
      ) : null}
    </div>
  )
}
