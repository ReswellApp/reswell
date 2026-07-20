"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Activity, Loader2, RefreshCw } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { runOpsIngestNowAction } from "@/lib/actions/opsAdmin"
import type { OpsGroupRow, OpsIngestRunRow } from "@/lib/types/ops"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = ["all", "open", "acknowledged", "resolved", "ignored"] as const
const SOURCE_OPTIONS = ["all", "vercel", "supabase", "client", "server"] as const

function severityClass(severity: OpsGroupRow["severity"]): string {
  if (severity === "critical") return "text-red-700"
  if (severity === "warning") return "text-amber-700"
  return "text-muted-foreground"
}

export function OpsAdminClient() {
  const [rows, setRows] = useState<OpsGroupRow[]>([])
  const [runs, setRuns] = useState<OpsIngestRunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("open")
  const [source, setSource] = useState<(typeof SOURCE_OPTIONS)[number]>("all")
  const [q, setQ] = useState("")
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("status", status)
      params.set("source", source)
      if (q.trim()) params.set("q", q.trim())

      const res = await fetch(`/api/admin/ops?${params.toString()}`, {
        credentials: "same-origin",
      })
      const json = (await res.json()) as {
        data?: { groups?: OpsGroupRow[]; runs?: OpsIngestRunRow[] }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ops"
      console.error("[admin ops]", message)
      toast.error(message)
      setRows([])
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [status, source, q])

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
      toast.success(
        `Ingested Vercel ${result.data.vercel.signalsIngested} + Supabase ${result.data.supabase.signalsIngested} signals`,
      )
      void load()
    })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5" aria-hidden />
              Platform ops
            </CardTitle>
            <CardDescription>
              Unified queue for Vercel request logs, Supabase project logs, and client/server app
              errors. Create fix tickets from any group.
            </CardDescription>
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
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Pull logs now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-full sm:w-[160px]">
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
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, ref, path…"
              className="sm:max-w-xs"
            />
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No issues match these filters. Pull logs or wait for client errors to appear.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ref</TableHead>
                  <TableHead className="w-[90px]">Source</TableHead>
                  <TableHead className="w-[90px]">Severity</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[70px]">Count</TableHead>
                  <TableHead className="w-[110px]">Last seen</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top font-mono text-xs">
                      <Link
                        href={`/admin/ops/${row.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.reference_code}
                      </Link>
                    </TableCell>
                    <TableCell className="align-top text-xs uppercase tracking-wide text-muted-foreground">
                      {row.source}
                    </TableCell>
                    <TableCell
                      className={cn("align-top text-xs font-medium", severityClass(row.severity))}
                    >
                      {row.severity}
                    </TableCell>
                    <TableCell className="align-top">
                      <Link href={`/admin/ops/${row.id}`} className="block hover:underline">
                        <div className="text-sm font-medium text-foreground line-clamp-2">
                          {row.title}
                        </div>
                        {row.path ? (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {row.path}
                          </div>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="align-top text-sm tabular-nums">
                      {row.occurrence_count}
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="align-top text-xs capitalize">{row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent ingest runs</CardTitle>
          <CardDescription>Vercel / Supabase log pull health</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingest runs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <span>
                    <span className="font-medium capitalize">{run.source}</span>{" "}
                    <span className="text-muted-foreground">· {run.status}</span>
                    {run.error_message ? (
                      <span className="ml-2 text-xs text-amber-700">{run.error_message}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    +{run.signals_ingested} signals ·{" "}
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
