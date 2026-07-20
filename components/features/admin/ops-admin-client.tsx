"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Activity,
  Cloud,
  Database,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { runOpsIngestNowAction } from "@/lib/actions/opsAdmin"
import type { OpsGroupRow, OpsIngestRunRow } from "@/lib/types/ops"
import {
  emptyOpsViewCounts,
  isReactOpsError,
  type OpsView,
  type OpsViewCounts,
} from "@/lib/utils/opsClassify"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = ["open", "acknowledged", "resolved", "ignored", "all"] as const

const VIEW_META: Record<
  OpsView,
  {
    label: string
    short: string
    description: string
    icon: typeof Activity
  }
> = {
  overview: {
    label: "Overview",
    short: "All",
    description: "Every open signal across Vercel, Supabase, browser, React, and server.",
    icon: Activity,
  },
  vercel: {
    label: "Vercel",
    short: "Vercel",
    description: "Production request-log issues (5xx, runtime errors, critical paths).",
    icon: Cloud,
  },
  supabase: {
    label: "Supabase",
    short: "Supabase",
    description: "Postgres, Auth, and Edge log errors pulled from the Management API.",
    icon: Database,
  },
  client: {
    label: "Client",
    short: "Client",
    description: "Browser / boundary errors that are not React runtime failures.",
    icon: MonitorSmartphone,
  },
  react: {
    label: "React",
    short: "React",
    description: "Minified React errors, hydration mismatches, and react-dom failures.",
    icon: TriangleAlert,
  },
  server: {
    label: "Server",
    short: "Server",
    description: "Exceptions captured from Next.js actions and API routes.",
    icon: Server,
  },
}

function severityTone(severity: OpsGroupRow["severity"]): string {
  if (severity === "critical") return "bg-red-500"
  if (severity === "warning") return "bg-amber-500"
  return "bg-slate-400"
}

function severityText(severity: OpsGroupRow["severity"]): string {
  if (severity === "critical") return "text-red-700 bg-red-50 ring-red-100"
  if (severity === "warning") return "text-amber-800 bg-amber-50 ring-amber-100"
  return "text-slate-600 bg-slate-50 ring-slate-100"
}

function viewChip(view: OpsView): string {
  switch (view) {
    case "vercel":
      return "bg-zinc-900 text-white"
    case "supabase":
      return "bg-emerald-700 text-white"
    case "client":
      return "bg-sky-700 text-white"
    case "react":
      return "bg-violet-700 text-white"
    case "server":
      return "bg-orange-700 text-white"
    default:
      return "bg-muted text-foreground"
  }
}

function classifyRowView(row: OpsGroupRow): OpsView {
  if (row.source === "client" && isReactOpsError(row)) return "react"
  if (row.source === "client") return "client"
  return row.source
}

function latestRunFor(
  runs: OpsIngestRunRow[],
  source: "vercel" | "supabase",
): OpsIngestRunRow | null {
  return runs.find((r) => r.source === source) ?? null
}

function runStatusTone(status: OpsIngestRunRow["status"]): string {
  if (status === "success") return "text-emerald-700 bg-emerald-50"
  if (status === "partial") return "text-amber-800 bg-amber-50"
  if (status === "skipped") return "text-slate-600 bg-slate-100"
  return "text-red-700 bg-red-50"
}

export function OpsAdminClient() {
  const [rows, setRows] = useState<OpsGroupRow[]>([])
  const [runs, setRuns] = useState<OpsIngestRunRow[]>([])
  const [counts, setCounts] = useState<OpsViewCounts>(emptyOpsViewCounts())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<OpsView>("overview")
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("open")
  const [q, setQ] = useState("")
  const [qDraft, setQDraft] = useState("")
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("status", status)
      params.set("view", view)
      if (q.trim()) params.set("q", q.trim())

      const res = await fetch(`/api/admin/ops?${params.toString()}`, {
        credentials: "same-origin",
      })
      const json = (await res.json()) as {
        data?: {
          groups?: OpsGroupRow[]
          runs?: OpsIngestRunRow[]
          counts?: OpsViewCounts
        }
        error?: string
      }

      if (!res.ok) {
        const message = json.error ?? `Failed to load ops (${res.status})`
        console.error("[admin ops]", message)
        toast.error(message)
        setRows([])
        setRuns([])
        return
      }

      setRows(json.data?.groups ?? [])
      setRuns(json.data?.runs ?? [])
      setCounts(json.data?.counts ?? emptyOpsViewCounts())
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ops"
      console.error("[admin ops]", message)
      toast.error(message)
      setRows([])
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [status, view, q])

  useEffect(() => {
    void load()
  }, [load])

  const runIngest = () => {
    startTransition(async () => {
      const result = await runOpsIngestNowAction()
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      const v = result.data.vercel
      const s = result.data.supabase
      toast.success(
        `Vercel ${v.status} (+${v.signalsIngested}) · Supabase ${s.status} (+${s.signalsIngested})`,
      )
      void load()
    })
  }

  const meta = VIEW_META[view]
  const vercelRun = useMemo(() => latestRunFor(runs, "vercel"), [runs])
  const supabaseRun = useMemo(() => latestRunFor(runs, "supabase"), [runs])

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-background to-background">
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              DevOps
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Platform ops
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              Refresh
            </Button>
            <Button size="sm" disabled={pending} onClick={runIngest}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Pull logs now
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {(Object.keys(VIEW_META) as OpsView[]).map((key) => {
            const item = VIEW_META[key]
            const Icon = item.icon
            const active = view === key
            const count = counts[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-foreground/20 bg-white shadow-sm ring-1 ring-foreground/10"
                    : "border-border/70 bg-white/60 hover:bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {item.short}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                      count > 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{count}</p>
                <p className="text-[11px] text-muted-foreground">open</p>
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <IngestHealthCard title="Vercel ingest" run={vercelRun} />
          <IngestHealthCard title="Supabase ingest" run={supabaseRun} />
        </div>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-4 border-b bg-white/80 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">{meta.label} issues</CardTitle>
                <CardDescription>
                  {loading ? "Loading…" : `${rows.length} shown`} · status filter applies to this
                  view
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setQ(qDraft)
                  }}
                >
                  <Input
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    placeholder="Search title, ref, path…"
                    className="sm:w-[240px]"
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Search
                  </Button>
                </form>
              </div>
            </div>

            <Tabs value={view} onValueChange={(v) => setView(v as OpsView)}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/80 p-1">
                {(Object.keys(VIEW_META) as OpsView[]).map((key) => (
                  <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                    {VIEW_META[key].short}
                    <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {counts[key]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="p-0">
            {loading && rows.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading issues…
              </div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-foreground">No issues in this view</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {view === "vercel" || view === "supabase"
                    ? "Pull logs once tokens are set, or widen the status filter."
                    : "Client and React errors appear when users hit failures in the app."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {rows.map((row) => {
                  const rowView = classifyRowView(row)
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/admin/ops/${row.id}`}
                        className="group flex gap-3 px-4 py-4 transition-colors hover:bg-slate-50/80 sm:px-6"
                      >
                        <span
                          className={cn("mt-1 w-1 shrink-0 rounded-full", severityTone(row.severity))}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.reference_code}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                viewChip(rowView),
                              )}
                            >
                              {rowView}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                severityText(row.severity),
                              )}
                            >
                              {row.severity}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                              {row.status}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-medium text-foreground group-hover:underline line-clamp-2">
                            {row.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {row.path ? (
                              <span className="font-mono">{row.path}</span>
                            ) : null}
                            <span className="tabular-nums">{row.occurrence_count}×</span>
                            <span>
                              {formatDistanceToNow(new Date(row.last_seen_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingest history</CardTitle>
            <CardDescription>Recent Vercel / Supabase pull attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingest runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium capitalize">{run.source}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          runStatusTone(run.status),
                        )}
                      >
                        {run.status}
                      </span>
                      {run.error_message ? (
                        <span className="max-w-xl text-xs text-muted-foreground line-clamp-2">
                          {run.error_message}
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      +{run.signals_ingested} ·{" "}
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function IngestHealthCard({
  title,
  run,
}: {
  title: string
  run: OpsIngestRunRow | null
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-base">
          {run ? (
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                runStatusTone(run.status),
              )}
            >
              {run.status}
            </span>
          ) : (
            <span className="text-sm font-normal text-muted-foreground">No runs yet</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {run ? (
          <div className="space-y-1">
            <p>
              +{run.signals_ingested} signals ·{" "}
              {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
            </p>
            {run.error_message ? (
              <p className="line-clamp-2 text-amber-800">{run.error_message}</p>
            ) : (
              <p>Last pull completed without a stored error.</p>
            )}
          </div>
        ) : (
          <p>Pull logs to populate health.</p>
        )}
      </CardContent>
    </Card>
  )
}
