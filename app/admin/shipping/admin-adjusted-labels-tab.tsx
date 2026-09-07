"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DollarSign, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { LocalDateTime } from "@/components/ui/local-datetime"

type AdjustedLabelRow = {
  id: string
  report_id: string
  tracking_number: string | null
  shipment_id: string | null
  adjustment_type: string | null
  reason_code: string | null
  adjustment_amount_usd: number
  adjustment_at: string | null
  actual_service: string | null
  actual_package: string | null
  actual_weight: number | null
  actual_length: number | null
  actual_width: number | null
  actual_height: number | null
  order_id: string | null
  created_at: string
  orderDisplayNum: string | null
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDims(row: AdjustedLabelRow): string {
  const parts = [row.actual_length, row.actual_width, row.actual_height]
  if (parts.every((n) => n == null || n === 0)) return "—"
  return parts.map((n) => (n == null ? "—" : String(n))).join(" × ")
}

export function AdminAdjustedLabelsTab() {
  const [rows, setRows] = useState<AdjustedLabelRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/shipping/adjusted-labels?limit=100", {
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: AdjustedLabelRow[]
        total?: number
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error || "Could not load adjusted labels")
      }
      setRows(body.data ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load adjusted labels")
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/admin/shipping/adjusted-labels", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      })
      const body = (await res.json()) as {
        data?: { reportsIngested: number; increasedRows: number; skipped: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error?.trim() || "Could not sync ShipEngine adjustments")
        return
      }
      const ingested = body.data?.reportsIngested ?? 0
      const increased = body.data?.increasedRows ?? 0
      const skipped = body.data?.skipped ?? 0
      toast.success(
        ingested > 0
          ? `Ingested ${ingested} report${ingested === 1 ? "" : "s"} · ${increased} price increase${increased === 1 ? "" : "s"}`
          : skipped > 0
            ? "Already up to date"
            : "No new adjustment reports",
      )
      void load({ silent: true })
    } catch {
      toast.error("Could not sync ShipEngine adjustments")
    } finally {
      setSyncing(false)
    }
  }

  const extraBilled = rows.reduce((sum, row) => sum + (row.adjustment_amount_usd > 0 ? row.adjustment_amount_usd : 0), 0)

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Adjusted labels
            </CardTitle>
            <CardDescription className="text-sm">
              ShipEngine post-shipment fee increases — weight, dimensions, or service mismatches after
              the label was bought. Nightly reports plus a daily cron keep this current.
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={loading || refreshing} onClick={() => void load()}>
              <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button type="button" disabled={syncing} onClick={() => void syncNow()}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync from ShipEngine
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} label{total === 1 ? "" : "s"} with a price increase
            {total > 0 ? ` · ${formatUsd(extraBilled)} shown on this page` : ""}
          </p>
        </CardContent>
      </Card>

      {error ? (
        <Alert className="rounded-2xl border-rose-500/30 bg-card">
          <TriangleAlert className="h-4 w-4 text-rose-600" />
          <AlertTitle className="font-semibold tracking-tight">Could not load adjustments</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Adjusted
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Increase
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tracking
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Order
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reason
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Actual
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading adjusted labels…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No price-increase adjustments yet. Sync from ShipEngine after the nightly report
                  lands, or wait for the daily cron.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {row.adjustment_at ? <LocalDateTime iso={row.adjustment_at} /> : "—"}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                    {formatUsd(row.adjustment_amount_usd)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.tracking_number || "—"}
                  </TableCell>
                  <TableCell>
                    {row.order_id ? (
                      <Link
                        href={`/admin/orders/${row.order_id}`}
                        className="font-mono text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {row.orderDisplayNum || row.order_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unmatched</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                    {[row.adjustment_type, row.reason_code].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{row.actual_service || "—"}</div>
                    <div>
                      {row.actual_weight != null ? `${row.actual_weight} lb` : "—"}
                      {row.actual_package ? ` · ${row.actual_package}` : ""}
                    </div>
                    <div>{formatDims(row)}</div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
