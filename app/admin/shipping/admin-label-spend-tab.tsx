"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { Download, Landmark, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { AdminShipEngineLabelSpend } from "@/lib/services/adminShipEngineLabelSpend"
import { defaultLabelSpendDateRange } from "@/lib/shipping/label-spend-math"
import { addBusinessDays, businessDayKeyFromMs } from "@/lib/utils/business-timezone"
import { downloadLabelSpendCsv } from "./shipping-export"

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function lastMonthRange(nowMs = Date.now()): { dateFrom: string; dateTo: string } {
  const today = businessDayKeyFromMs(nowMs)
  const thisMonthStart = `${today.slice(0, 7)}-01`
  const lastMonthEnd = addBusinessDays(thisMonthStart, -1)
  return { dateFrom: `${lastMonthEnd.slice(0, 7)}-01`, dateTo: lastMonthEnd }
}

function lastNDays(days: number, nowMs = Date.now()): { dateFrom: string; dateTo: string } {
  const today = businessDayKeyFromMs(nowMs)
  return { dateFrom: addBusinessDays(today, -(days - 1)), dateTo: today }
}

function kindLabel(kind: string): string {
  if (kind === "return") return "Return"
  if (kind === "voided") return "Voided"
  return "Outbound"
}

export function AdminLabelSpendTab() {
  const defaults = useMemo(() => defaultLabelSpendDateRange(), [])
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom)
  const [dateTo, setDateTo] = useState(defaults.dateTo)
  const [appliedFrom, setAppliedFrom] = useState(defaults.dateFrom)
  const [appliedTo, setAppliedTo] = useState(defaults.dateTo)
  const [data, setData] = useState<AdminShipEngineLabelSpend | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (from: string, to: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date_from: from, date_to: to })
      const res = await fetch(`/api/admin/shipping/label-spend?${params.toString()}`, {
        credentials: "include",
      })
      const body = (await res.json()) as { data?: AdminShipEngineLabelSpend; error?: string }
      if (!res.ok) {
        throw new Error(body.error || "Could not load ShipEngine label spend")
      }
      if (!body.data) throw new Error("Could not load ShipEngine label spend")
      setData(body.data)
      setAppliedFrom(from)
      setAppliedTo(to)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ShipEngine label spend")
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(defaults.dateFrom, defaults.dateTo)
  }, [defaults.dateFrom, defaults.dateTo, load])

  const applyRange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    void load(from, to)
  }

  const coverage =
    data != null ? data.totals.buyerShippingCollectedUsd - data.totals.transferUsd : 0

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight">
            ShipEngine label spend
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Buyer shipping and seller-paid labels collect in Stripe. Postage is billed on the
            ShipEngine account. Transfer the amount below from Stripe to your bank to cover labels
            purchased in this period ({data?.timezoneLabel ?? "Pacific Time"}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="label-spend-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="label-spend-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label-spend-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="label-spend-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Button
              onClick={() => void load(dateFrom, dateTo)}
              disabled={loading || refreshing || !dateFrom || !dateTo}
            >
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyRange(defaults.dateFrom, defaults.dateTo)}
              >
                This month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = lastMonthRange()
                  applyRange(range.dateFrom, range.dateTo)
                }}
              >
                Last month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = lastNDays(7)
                  applyRange(range.dateFrom, range.dateTo)
                }}
              >
                7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = lastNDays(30)
                  applyRange(range.dateFrom, range.dateTo)
                }}
              >
                30 days
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void load(appliedFrom, appliedTo, { silent: true })}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert className="rounded-2xl border-rose-500/30 bg-rose-500/5">
          <TriangleAlert className="h-4 w-4 text-rose-600" />
          <AlertTitle className="font-semibold tracking-tight">Could not load label spend</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading purchased labels from ShipEngine…
        </div>
      ) : data ? (
        <>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  Transfer from Stripe to bank
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-foreground">
                  {formatUsd(data.totals.transferUsd)}
                </p>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Postage {formatUsd(data.totals.postageUsd)}
                  {data.totals.insuranceUsd > 0
                    ? ` + insurance ${formatUsd(data.totals.insuranceUsd)}`
                    : ""}
                  {data.totals.adjustmentsUsd !== 0
                    ? ` + adjustments ${formatUsd(data.totals.adjustmentsUsd)}`
                    : ""}
                  . Voided labels are excluded.
                </p>
              </div>
              <Landmark className="h-8 w-8 text-emerald-700/70 dark:text-emerald-400/70" aria-hidden />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Labels purchased
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{data.totals.labelsPurchased}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.totals.labelsVoided} voided
                {data.totals.labelsReturn > 0 ? ` · ${data.totals.labelsReturn} return` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Buyer shipping collected
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatUsd(data.totals.buyerShippingCollectedUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.totals.matchedOrders} matched order
                {data.totals.matchedOrders === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Shipping vs postage
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold tabular-nums",
                  coverage >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {coverage >= 0 ? "+" : ""}
                {formatUsd(coverage)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Collected shipping − transfer amount
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Adjustments
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatUsd(data.totals.adjustmentsUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Carrier fee changes in range</p>
            </div>
          </div>

          {data.truncated ? (
            <Alert className="rounded-2xl border-amber-500/30 bg-amber-500/5">
              <TriangleAlert className="h-4 w-4 text-amber-700" />
              <AlertTitle className="font-semibold tracking-tight">List truncated</AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground">
                Showing {data.labels.length.toLocaleString()} of {data.listedTotal.toLocaleString()}{" "}
                ShipEngine labels. Narrow the date range to see the rest.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="rounded-2xl border-border bg-card">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">Purchased labels</CardTitle>
                <CardDescription className="text-sm">
                  {appliedFrom} → {appliedTo} · {data.labels.length.toLocaleString()} row
                  {data.labels.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={data.labels.length === 0}
                onClick={() => {
                  downloadLabelSpendCsv(
                    data.labels.map((row) => ({
                      createdAt: row.createdAt,
                      kind: row.kind,
                      orderDisplayNum: row.orderDisplayNum,
                      orderId: row.orderId,
                      trackingNumber: row.trackingNumber,
                      carrierCode: row.carrierCode,
                      serviceCode: row.serviceCode,
                      postageUsd: row.postageUsd,
                      insuranceUsd: row.insuranceUsd,
                      chargeUsd: row.chargeUsd,
                      labelId: row.labelId,
                    })),
                    appliedFrom,
                    appliedTo,
                  )
                  toast.success("CSV downloaded")
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto pt-0">
              {data.labels.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No ShipEngine labels in this range.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Purchased
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Order
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tracking
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Kind
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Charge
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.labels.map((row) => (
                        <TableRow key={row.labelId}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.createdAt ? <LocalDateTime iso={row.createdAt} /> : "—"}
                          </TableCell>
                          <TableCell>
                            {row.orderId && row.orderDisplayNum ? (
                              <Link
                                href={`/admin/orders/${row.orderId}`}
                                className="font-medium text-foreground/90 underline decoration-border underline-offset-4 hover:text-foreground"
                              >
                                #{row.orderDisplayNum}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-mono text-xs">{row.trackingNumber ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {[row.carrierCode, row.serviceCode].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                row.kind === "voided"
                                  ? "border-border bg-muted text-muted-foreground"
                                  : row.kind === "return"
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400"
                                    : "border-border bg-secondary text-foreground",
                              )}
                            >
                              {kindLabel(row.kind)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.voided ? (
                              <span className="text-muted-foreground">$0.00</span>
                            ) : (
                              formatUsd(row.chargeUsd)
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
