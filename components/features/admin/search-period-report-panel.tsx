"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SearchDailyReportBody,
  SearchDailyReportKpis,
  SearchPeriodRankedTables,
} from "@/components/features/admin/search-daily-report-body"
import type { SearchPeriodKind, SearchPeriodReportRow } from "@/lib/db/searchPeriodReports"
import type { SearchPeriodReportIndexItem } from "@/lib/services/searchPeriodReport"

type PeriodDashboardPayload = {
  defaultMonth: string
  currentMonth: string
  months: SearchPeriodReportIndexItem[]
  allTime: SearchPeriodReportIndexItem | null
  report: SearchPeriodReportRow | null
}

const MONTH_STRIP = 12
const ALL_TIME_KEY = "all"

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number)
  const dt = new Date(year, month - 1 + delta, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  if (!year || !month) return yearMonth
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function statusLabel(status: SearchPeriodReportIndexItem["status"]): string {
  if (status === "complete") return "Ready"
  if (status === "empty") return "Quiet window"
  if (status === "failed") return "Failed"
  return "Generating"
}

export function SearchPeriodReportPanel({ kind }: { kind: SearchPeriodKind }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openMonth = kind === "month" ? searchParams.get("month") : ALL_TIME_KEY

  const [payload, setPayload] = useState<PeriodDashboardPayload | null>(null)
  const [report, setReport] = useState<SearchPeriodReportRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [generating, setGenerating] = useState(false)
  const [applyingQuery, setApplyingQuery] = useState<string | null>(null)

  const setOpenMonth = useCallback(
    (month: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", "month")
      if (month) params.set("month", month)
      else params.delete("month")
      params.delete("date")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const load = useCallback(
    (key?: string | null) => {
      startTransition(async () => {
        setError(null)
        try {
          const params = new URLSearchParams({ kind, limit: "24" })
          if (kind === "month" && key) params.set("key", key)
          const res = await fetch(`/api/admin/search-period-report?${params}`, { cache: "no-store" })
          const json = (await res.json()) as { data?: PeriodDashboardPayload; error?: string }
          if (!res.ok) {
            setError(json.error ?? "Could not load period report")
            return
          }
          if (!json.data) {
            setError("Empty response")
            return
          }
          setPayload(json.data)
          setReport(json.data.report)
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load period report")
        }
      })
    },
    [kind],
  )

  useEffect(() => {
    load(kind === "month" ? openMonth : ALL_TIME_KEY)
  }, [kind, openMonth, load])

  const generate = useCallback(
    async (key: string, force: boolean) => {
      setGenerating(true)
      setError(null)
      try {
        const res = await fetch("/api/admin/search-period-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, key, force }),
        })
        const json = (await res.json()) as {
          data?: { key: string; status: string; row: SearchPeriodReportRow | null }
          error?: string
        }
        if (!res.ok) {
          setError(json.error ?? "Could not generate report")
          return
        }
        if (json.data?.row) setReport(json.data.row)
        if (kind === "month") setOpenMonth(json.data?.key ?? key)
        load(json.data?.key ?? key)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate report")
      } finally {
        setGenerating(false)
      }
    },
    [kind, load, setOpenMonth],
  )

  const applySynonym = useCallback(
    async (query: string) => {
      const periodKey = kind === "month" ? openMonth : ALL_TIME_KEY
      if (!periodKey || applyingQuery) return
      setApplyingQuery(query)
      setError(null)
      try {
        const res = await fetch("/api/admin/search-daily-report/synonyms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodKind: kind, periodKey, query }),
        })
        const json = (await res.json()) as {
          data?: { report: SearchPeriodReportRow }
          error?: string
        }
        if (!res.ok || !json.data?.report) {
          setError(json.error ?? "Could not add synonym")
          return
        }
        setReport(json.data.report)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add synonym")
      } finally {
        setApplyingQuery(null)
      }
    },
    [kind, openMonth, applyingQuery],
  )

  const months = payload?.months ?? []
  const byKey = useMemo(() => new Map(months.map((m) => [m.key, m])), [months])
  const stripMonths = useMemo(() => {
    const end = payload?.currentMonth
    if (!end || kind !== "month") return []
    return Array.from({ length: MONTH_STRIP }, (_, i) => shiftYearMonth(end, -(MONTH_STRIP - 1 - i)))
  }, [payload?.currentMonth, kind])

  const openIndex =
    kind === "all_time"
      ? payload?.allTime ?? null
      : openMonth
        ? byKey.get(openMonth) ?? null
        : null
  const busy = pending || generating || applyingQuery != null
  const title = kind === "month" ? "Monthly search reports" : "All-time search history"
  const subtitle =
    kind === "month"
      ? "One briefing per Pacific month. Ranked searches, a demand list, and the same inventory / search / seller actions as the daily report."
      : "Every logged marketplace search since tracking began. Biggest demand list and the same briefing sections as the daily report."
  const generateLabel =
    kind === "all_time"
      ? report
        ? "Regenerate all-time"
        : "Generate all-time"
      : openMonth && byKey.has(openMonth)
        ? "Regenerate month"
        : "Generate last month"

  return (
    <div className="min-h-[60vh] w-full max-w-[1100px] space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Gemini 2.5 · {kind === "month" ? "Pacific month" : "All recorded searches"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">{subtitle}</p>
            <p className="mt-2 text-xs text-slate-500">
              Cron 15:00 UTC on the 1st · uses the same Gemini flag as daily reports
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
              onClick={() => load(kind === "month" ? openMonth : ALL_TIME_KEY)}
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
              disabled={busy || !payload}
              onClick={() =>
                payload &&
                void generate(
                  kind === "all_time"
                    ? ALL_TIME_KEY
                    : (openMonth ?? payload.defaultMonth),
                  true,
                )
              }
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-2">{generateLabel}</span>
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}

      {kind === "month" && stripMonths.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Last {MONTH_STRIP} months</h3>
            <p className="text-[11px] text-slate-500">Click a month to open its report.</p>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {stripMonths.map((ym) => {
              const item = byKey.get(ym)
              const selected = openMonth === ym
              return (
                <button
                  key={ym}
                  type="button"
                  title={formatMonthLabel(ym)}
                  onClick={() => setOpenMonth(selected ? null : ym)}
                  className={cn(
                    "flex h-16 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg border text-[11px] transition-colors",
                    item
                      ? "border-slate-200 bg-slate-50 text-slate-800"
                      : "border-dashed border-slate-200 bg-white text-slate-400",
                    selected && "ring-2 ring-slate-900 ring-offset-1",
                  )}
                >
                  <span className="font-semibold">{formatMonthLabel(ym).split(" ")[0]?.slice(0, 3)}</span>
                  <span className="text-[10px] tabular-nums text-slate-500">{ym.slice(0, 4)}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {pending && !report && months.length === 0 && kind === "month" ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reports…
        </div>
      ) : null}

      {kind === "month"
        ? months.map((item) => {
            const isOpen = openMonth === item.key
            return (
              <section key={item.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-stretch">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => setOpenMonth(isOpen ? null : item.key)}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                        isOpen && "rotate-180 text-slate-700",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{formatMonthLabel(item.key)}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            item.status === "complete" && "bg-emerald-50 text-emerald-800",
                            item.status === "failed" && "bg-rose-50 text-rose-800",
                            item.status === "empty" && "bg-slate-100 text-slate-600",
                            item.status === "generating" && "bg-amber-50 text-amber-800",
                          )}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs tabular-nums text-slate-500">
                        {item.totalSearches.toLocaleString()} searches · {item.zeroResultEventCount} empty
                        {item.demandListCount > 0 ? ` · ${item.demandListCount} demand items` : ""}
                        {item.synonymAppliedCount > 0 ? ` · ${item.synonymAppliedCount} synonyms added` : ""}
                      </p>
                      {item.executiveSummary ? (
                        <p className={cn("mt-1 text-sm text-slate-600", isOpen ? "" : "line-clamp-2")}>
                          {item.executiveSummary}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  {isOpen ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 px-4 text-sm text-slate-500 hover:text-slate-900"
                      onClick={() => setOpenMonth(null)}
                    >
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  ) : (
                    <span className="hidden items-center px-4 text-xs font-medium text-slate-400 sm:flex">
                      Open
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <PeriodReportDetail
                    report={report?.period_key === item.key ? report : null}
                    index={item}
                    busy={busy}
                    generating={generating}
                    pending={pending}
                    applyingQuery={applyingQuery}
                    recurringNoun="months"
                    onGenerate={() => void generate(item.key, true)}
                    onClose={() => setOpenMonth(null)}
                    onApplySynonym={(query) => void applySynonym(query)}
                  />
                ) : null}
              </section>
            )
          })
        : null}

      {kind === "all_time" ? (
        report || payload?.allTime ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">All-time search history</p>
              {openIndex ? (
                <p className="mt-1 text-xs tabular-nums text-slate-500">
                  {openIndex.totalSearches.toLocaleString()} searches · {openIndex.zeroResultEventCount} empty
                  {openIndex.demandListCount > 0 ? ` · ${openIndex.demandListCount} demand items` : ""}
                </p>
              ) : null}
            </div>
            <PeriodReportDetail
              report={report}
              index={openIndex}
              busy={busy}
              generating={generating}
              pending={pending}
              applyingQuery={applyingQuery}
              recurringNoun="periods"
              onGenerate={() => void generate(ALL_TIME_KEY, true)}
              onClose={null}
              onApplySynonym={(query) => void applySynonym(query)}
            />
          </section>
        ) : !pending ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">No all-time report yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Generate one from every logged search, dropdown pick, and empty result.
            </p>
            <Button className="mt-4" disabled={busy} onClick={() => void generate(ALL_TIME_KEY, true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate all-time history
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading all-time report…
          </div>
        )
      ) : null}

      {kind === "month" && openMonth && !byKey.has(openMonth) && payload ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No report for {formatMonthLabel(openMonth)}</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate one from that month’s logged searches, dropdown picks, and empty results.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button disabled={busy} onClick={() => void generate(openMonth, true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with Gemini
            </Button>
            <Button variant="outline" onClick={() => setOpenMonth(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {kind === "month" && !pending && payload && months.length === 0 && !openMonth ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No monthly reports yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate last month’s briefing, or wait for the 1st-of-month cron.
          </p>
          <Button className="mt-4" disabled={busy} onClick={() => void generate(payload.defaultMonth, true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate last month
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PeriodReportDetail({
  report,
  index,
  busy,
  generating,
  pending,
  applyingQuery,
  recurringNoun,
  onGenerate,
  onClose,
  onApplySynonym,
}: {
  report: SearchPeriodReportRow | null
  index: SearchPeriodReportIndexItem | null
  busy: boolean
  generating: boolean
  pending: boolean
  applyingQuery: string | null
  recurringNoun: string
  onGenerate: () => void
  onClose: (() => void) | null
  onApplySynonym: (query: string) => void
}) {
  return (
    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" className="h-8" disabled={busy} onClick={onGenerate}>
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Regenerate</span>
        </Button>
        {onClose ? (
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            <span className="ml-1.5">Close report</span>
          </Button>
        ) : null}
      </div>

      {report?.status === "failed" ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Report did not complete</p>
            <p className="mt-1">{report.error ?? index?.error ?? "Unknown error"}</p>
          </div>
        </div>
      ) : null}

      {pending && !report ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening report…
        </div>
      ) : null}

      {report?.snapshot ? <SearchDailyReportKpis snapshot={report.snapshot} /> : null}
      {report?.snapshot ? <SearchPeriodRankedTables snapshot={report.snapshot} /> : null}

      {report?.report ? (
        <SearchDailyReportBody
          report={report.report}
          applyingQuery={applyingQuery}
          onApplySynonym={onApplySynonym}
          emptyLabel="Nothing flagged for this period."
          recurringNoun={recurringNoun}
        />
      ) : null}

      {generating ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Regenerating with Gemini — a longer window can take a couple of minutes.
        </p>
      ) : null}
    </div>
  )
}
