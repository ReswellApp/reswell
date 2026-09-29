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
import { LocalDateTime } from "@/components/ui/local-datetime"
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import type { PostageRecoverySnapshot } from "@/lib/db/shipenginePostageRecovery"
import type { PostageDisposition } from "@/lib/shipping/unused-label-void-policy"

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function dispositionLabel(disposition: PostageDisposition): string {
  switch (disposition) {
    case "expired_unrecoverable":
      return "Past void deadline"
    case "void_denied":
      return "Void denied"
    case "scan_unconfirmed":
      return "Scan not confirmed"
    case "refund_pending":
      return "Void not confirmed"
    case "void_skipped":
      return "Auto-void paused"
    case "voided_balance":
      return "Credited to balance"
    case "voided_ups_account":
      return "UPS not billed"
    case "voided_unconfirmed_billing":
      return "Voided"
    case "scanned_keep":
      return "Scanned"
    case "approaching":
      return "Approaching day 20"
    case "in_grace":
      return "Inside 16 days"
    default:
      return disposition
  }
}

export function AdminPostageRecoveryTab() {
  const [data, setData] = useState<PostageRecoverySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/shipping/postage-recovery", { credentials: "include" })
      const body = (await res.json()) as { data?: PostageRecoverySnapshot | null; error?: string }
      if (!res.ok) throw new Error(body.error || "Could not load postage recovery")
      setData(body.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load postage recovery")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runNow = async () => {
    setRunning(true)
    try {
      const res = await fetch("/api/admin/shipping/postage-recovery", {
        method: "POST",
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: PostageRecoverySnapshot
        warnings?: string[]
        error?: string
      }
      if (!res.ok || !body.data) throw new Error(body.error || "Postage recovery failed")
      setData(body.data)
      const cracks = body.data.summary.cracksUsd
      toast.success(
        body.data.summary.voidedThisRunCount > 0
          ? `Voided ${body.data.summary.voidedThisRunCount} unused label${body.data.summary.voidedThisRunCount === 1 ? "" : "s"} (${formatUsd(body.data.summary.voidedThisRunUsd)}).`
          : "Audit finished. No new voids.",
      )
      if (cracks > 0) toast.warning(`${formatUsd(cracks)} still needs attention.`)
      for (const warning of body.warnings ?? []) toast.warning(warning)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Postage recovery failed")
    } finally {
      setRunning(false)
    }
  }

  const summary = data?.summary

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Unused postage</CardTitle>
            <CardDescription className="max-w-2xl">
              Labels with no carrier scan for 20 days are voided. Wallet postage is credited to the ShipEngine
              balance. Reswell&apos;s own UPS account is post-billed, so an unscanned void is never invoiced.
              Buyers are not refunded.
            </CardDescription>
          </div>
          <Button onClick={() => void runNow()} disabled={running} className="shrink-0">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recover unused postage
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading the latest audit…</p> : null}
          {error ? (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Could not load the audit</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && !error && !data ? (
            <p className="text-sm text-muted-foreground">
              No audit yet. Recovery also runs twice a day. Run it now to void unused labels before the carrier
              deadline (USPS 28 days, other carriers 30).
            </p>
          ) : null}
          {data && summary ? (
            <>
              <p className="text-xs text-muted-foreground">
                Last run <LocalDateTime iso={data.finishedAt} /> · {data.listedCount} labels in the last{" "}
                {data.lookbackDays} days
                {data.autoVoidEnabled ? "" : " · auto-void is paused"}
                {data.truncated ? " · ShipEngine list was truncated" : ""}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Recovered to balance" value={formatUsd(summary.recoveredBalanceUsd)} hint={`${summary.recoveredBalanceCount} voided`} />
                <Stat label="Voided this run" value={formatUsd(summary.voidedThisRunUsd)} hint={`${summary.voidedThisRunCount} labels`} />
                <Stat label="UPS not billed" value={formatUsd(summary.recoveredUpsUsd)} hint={`${summary.recoveredUpsCount} own-account`} />
                <Stat label="Slipping through" value={formatUsd(summary.cracksUsd)} hint={`${summary.cracksCount} need attention`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Approaching day 20" value={formatUsd(summary.approachingUsd)} hint={`${summary.approachingCount} unscanned`} />
                <Stat label="Past deadline" value={formatUsd(summary.expiredLostUsd)} hint={`${summary.expiredLostCount} too late to void`} />
                <Stat label="Inside 16 days" value={formatUsd(summary.inGraceUsd)} hint={`${summary.inGraceCount} not eligible to void yet`} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {data && data.cracks.length > 0 ? (
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
            <CardDescription>
              Denied voids, unconfirmed scans, and labels already past the carrier deadline. These are the dollars
              that will not come back unless the next run can still void them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LabelTable rows={data.cracks} />
          </CardContent>
        </Card>
      ) : null}

      {data && data.recoveredThisRun.length > 0 ? (
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Voided this run</CardTitle>
            <CardDescription>Confirmed voided in ShipEngine. Wallet labels credit the balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <LabelTable rows={data.recoveredThisRun} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function LabelTable({ rows }: { rows: PostageRecoverySnapshot["cracks"] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Postage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.labelId}-${row.disposition}`}>
              <TableCell>
                <p className="font-mono text-xs">{row.labelId}</p>
                <p className="text-xs text-muted-foreground">
                  {row.trackingNumber || "No tracking"}
                  {row.orderId ? (
                    <>
                      {" · "}
                      <Link href={`/admin/orders/${row.orderId}`} className="underline">
                        Order
                      </Link>
                    </>
                  ) : null}
                  {row.isReturnLabel ? " · Return" : ""}
                </p>
              </TableCell>
              <TableCell className="tabular-nums">{row.ageDays}d</TableCell>
              <TableCell>
                <p>{dispositionLabel(row.disposition)}</p>
                {row.message ? <p className="max-w-sm text-xs text-muted-foreground">{row.message}</p> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(row.faceUsd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
