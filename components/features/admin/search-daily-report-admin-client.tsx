"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SearchDailyReportBody,
  SearchDailyReportKpis,
} from "@/components/features/admin/search-daily-report-body"
import type {
  SearchDailyReportIndexItem,
  SearchDailyReportRow,
} from "@/lib/services/searchDailyReport"

type DashboardPayload = {
  defaultDate: string
  todayPacific: string
  days: SearchDailyReportIndexItem[]
  report: SearchDailyReportRow | null
}

const STRIP_DAYS = 28

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + days))
  return dt.toISOString().slice(0, 10)
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

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function weekdayShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { weekday: "short" })
}

function dayNumber(ymd: string): string {
  return String(Number(ymd.slice(8, 10)))
}

function emptyTone(share: number | null, hasReport: boolean): string {
  if (!hasReport) return "border-dashed border-slate-200 bg-white text-slate-400"
  if (share == null || share <= 0) return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (share < 0.15) return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-rose-200 bg-rose-50 text-rose-900"
}

function statusLabel(status: SearchDailyReportIndexItem["status"]): string {
  if (status === "complete") return "Ready"
  if (status === "empty") return "Quiet day"
  if (status === "failed") return "Failed"
  return "Generating"
}

function groupByMonth(days: SearchDailyReportIndexItem[]): { month: string; rows: SearchDailyReportIndexItem[] }[] {
  const groups: { month: string; rows: SearchDailyReportIndexItem[] }[] = []
  for (const row of days) {
    const month = row.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.rows.push(row)
    else groups.push({ month, rows: [row] })
  }
  return groups
}

export function SearchDailyReportAdminClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openDate = searchParams.get("date")

  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [cache, setCache] = useState<Record<string, SearchDailyReportRow>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [generating, setGenerating] = useState(false)
  const [applyingQuery, setApplyingQuery] = useState<string | null>(null)

  const setOpenDate = useCallback(
    (date: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (date) params.set("date", date)
      else params.delete("date")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const load = useCallback((date?: string | null) => {
    startTransition(async () => {
      setError(null)
      try {
        const params = new URLSearchParams({ limit: "90" })
        if (date) params.set("date", date)
        const res = await fetch(`/api/admin/search-daily-report?${params}`, { cache: "no-store" })
        const json = (await res.json()) as { data?: DashboardPayload; error?: string }
        if (!res.ok) {
          setError(json.error ?? "Could not load daily reports")
          return
        }
        if (!json.data) {
          setError("Empty response")
          return
        }
        setPayload(json.data)
        if (json.data.report) {
          setCache((prev) => ({ ...prev, [json.data!.report!.report_date]: json.data!.report! }))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load daily reports")
      }
    })
  }, [])

  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const skipNextOpenFetch = useRef(true)

  useEffect(() => {
    load(openDate)
  }, [load])

  useEffect(() => {
    if (skipNextOpenFetch.current) {
      skipNextOpenFetch.current = false
      return
    }
    if (!openDate) return
    if (cacheRef.current[openDate]?.report) return
    load(openDate)
  }, [openDate, load])

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
        const nextDate = json.data?.date ?? date
        if (json.data?.row) {
          setCache((prev) => ({ ...prev, [nextDate]: json.data!.row! }))
        }
        setOpenDate(nextDate)
        load(nextDate)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate report")
      } finally {
        setGenerating(false)
      }
    },
    [load, setOpenDate],
  )

  const applySynonym = useCallback(
    async (query: string) => {
      if (!openDate || applyingQuery) return
      setApplyingQuery(query)
      setError(null)
      try {
        const res = await fetch("/api/admin/search-daily-report/synonyms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: openDate, query }),
        })
        const json = (await res.json()) as {
          data?: { report: SearchDailyReportRow }
          error?: string
        }
        if (!res.ok || !json.data?.report) {
          setError(json.error ?? "Could not add synonym")
          return
        }
        const updated = json.data.report
        setCache((prev) => ({ ...prev, [updated.report_date]: updated }))
        setPayload((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            report: updated,
            days: prev.days.map((day) =>
              day.date === updated.report_date
                ? {
                    ...day,
                    executiveSummary: updated.report?.executiveSummary ?? day.executiveSummary,
                    synonymAppliedCount: (updated.report?.synonymProposals ?? []).filter(
                      (p) => p.applied,
                    ).length,
                    emptyFixCount: updated.report?.emptySearchFixes.length ?? day.emptyFixCount,
                  }
                : day,
            ),
          }
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add synonym")
      } finally {
        setApplyingQuery(null)
      }
    },
    [openDate, applyingQuery],
  )

  const days = payload?.days ?? []
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const monthGroups = useMemo(() => groupByMonth(days), [days])
  const stripDates = useMemo(() => {
    const end = payload?.todayPacific
    if (!end) return []
    return Array.from({ length: STRIP_DAYS }, (_, i) => shiftYmd(end, -(STRIP_DAYS - 1 - i)))
  }, [payload?.todayPacific])

  const openRow = openDate ? cache[openDate] ?? payload?.report ?? null : null
  const openIndex = openDate ? byDate.get(openDate) ?? null : null
  const busy = pending || generating || applyingQuery != null

  return (
    <div className="min-h-[60vh] w-full max-w-[1100px] space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Gemini 2.5 · Pacific day
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Search daily reports</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              One card per day. Open a report to read it, close it to get back to the calendar.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              <Link href="/admin/search-analytics" className="underline underline-offset-2">
                Search analytics
              </Link>
              {" · "}
              <Link href="/admin/search-curation" className="underline underline-offset-2">
                Search curation
              </Link>
              {" · "}
              Cron 14:30 UTC
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
              onClick={() => load(openDate)}
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
              onClick={() => payload && void generate(openDate ?? payload.defaultDate, true)}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-2">
                {openDate && byDate.has(openDate) ? "Regenerate day" : "Generate yesterday"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}

      {stripDates.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Last {STRIP_DAYS} days</h3>
            <p className="text-[11px] text-slate-500">Color = empty-result rate. Click a day to open.</p>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {stripDates.map((ymd) => {
              const item = byDate.get(ymd)
              const selected = openDate === ymd
              return (
                <button
                  key={ymd}
                  type="button"
                  title={formatDateLabel(ymd)}
                  onClick={() => setOpenDate(selected ? null : ymd)}
                  className={cn(
                    "flex h-16 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-[11px] transition-colors",
                    emptyTone(item?.zeroResultShare ?? null, Boolean(item)),
                    selected && "ring-2 ring-slate-900 ring-offset-1",
                  )}
                >
                  <span className="font-semibold tabular-nums">{dayNumber(ymd)}</span>
                  <span className="text-[10px] uppercase tracking-wide">{weekdayShort(ymd).slice(0, 2)}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {pending && days.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reports…
        </div>
      ) : null}

      {monthGroups.map((group) => (
        <section key={group.month} className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-slate-900">{formatMonthLabel(group.month)}</h3>
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {group.rows.map((item) => {
              const isOpen = openDate === item.date
              return (
                <li key={item.date} className={cn("border-b border-slate-100 last:border-b-0", isOpen && "bg-slate-50/40")}>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => setOpenDate(isOpen ? null : item.date)}
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
                          <p className="text-sm font-semibold text-slate-900">{formatDateLabel(item.date)}</p>
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
                          {item.synonymAppliedCount > 0 ? ` · ${item.synonymAppliedCount} synonyms added` : ""}
                          {item.emptyFixCount > 0 ? ` · ${item.emptyFixCount} empty-query fixes` : ""}
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
                        onClick={() => setOpenDate(null)}
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
                    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={busy}
                          onClick={() => void generate(item.date, true)}
                        >
                          {generating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">Regenerate</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setOpenDate(null)}>
                          <X className="h-3.5 w-3.5" />
                          <span className="ml-1.5">Close report</span>
                        </Button>
                      </div>

                      {openRow?.status === "failed" ? (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-medium">Report did not complete</p>
                            <p className="mt-1">{openRow.error ?? openIndex?.error ?? "Unknown error"}</p>
                          </div>
                        </div>
                      ) : null}

                      {pending && !openRow ? (
                        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Opening report…
                        </div>
                      ) : null}

                      {openRow?.snapshot ? <SearchDailyReportKpis snapshot={openRow.snapshot} /> : null}

                      {openRow?.report ? (
                        <SearchDailyReportBody
                          report={openRow.report}
                          applyingQuery={applyingQuery}
                          onApplySynonym={(query) => void applySynonym(query)}
                        />
                      ) : null}

                      {generating ? (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Regenerating with Gemini — this can take up to a minute.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {openDate && !byDate.has(openDate) && payload ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No report for {formatDateLabel(openDate)}</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate one from that day’s logged searches, dropdown picks, and empty results.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button disabled={busy} onClick={() => void generate(openDate, true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with Gemini
            </Button>
            <Button variant="outline" onClick={() => setOpenDate(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {!pending && payload && days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No daily reports yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate yesterday’s briefing, or wait for the 14:30 UTC cron.
          </p>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => void generate(payload.defaultDate, true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate yesterday
          </Button>
        </div>
      ) : null}
    </div>
  )
}
