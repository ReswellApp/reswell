"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, Loader2, Printer, RefreshCw, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { LocalDateTime } from "@/components/ui/local-datetime"

type FailureRow = {
  id: string
  order_id: string
  failure_stage: string
  error_message: string
  created_at: string
  updated_at: string
  orderDisplayNum: string
  orderCreatedAt: string | null
  listingTitle: string
  listingSection: string | null
  fulfillmentMethod: string | null
  deliveryStatus: string | null
  buyerPaidShippingUsd: number | null
  buyer: { display_name: string | null; email: string | null }
  seller: { display_name: string | null; email: string | null }
}

function stageLabel(stage: string): string {
  switch (stage) {
    case "shipengine_not_configured":
      return "ShipEngine not configured"
    case "incomplete_address":
      return "Incomplete address"
    case "rate_quote":
      return "Rate quote failed"
    case "rate_id":
      return "No rate ID"
    case "label_purchase":
      return "Label purchase failed"
    case "attach_label":
      return "Could not attach label"
    default:
      return stage
  }
}

interface AdminFailedLabelsTabProps {
  onOpenCountChange?: (count: number) => void
  onResolved?: () => void
}

export function AdminFailedLabelsTab({ onOpenCountChange, onResolved }: AdminFailedLabelsTabProps) {
  const [rows, setRows] = useState<FailureRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [labelReadyOpen, setLabelReadyOpen] = useState(false)
  const [labelReady, setLabelReady] = useState<{
    labelUrl: string | null
    trackingNumber: string
    orderDisplayNum: string
  } | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setLoading(true)
    else setRefreshing(true)

    try {
      const res = await fetch("/api/admin/shipping/label-failures?limit=50", { credentials: "include" })
      const body = (await res.json()) as {
        data?: FailureRow[]
        total?: number
        openCount?: number
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error ?? "Could not load failed labels")
        return
      }
      const nextRows = body.data ?? []
      setRows(nextRows)
      setTotal(body.total ?? nextRows.length)
      onOpenCountChange?.(body.openCount ?? nextRows.length)
    } catch {
      toast.error("Could not load failed labels")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onOpenCountChange])

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const createLabel = async (row: FailureRow) => {
    setBusyOrderId(row.order_id)
    try {
      const res = await fetch("/api/admin/shipping/order-label", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: row.order_id, action: "purchase_checkout_lane" }),
      })
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          orderDisplayNum: string
          quoteVsPaidNote?: string
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        const msg = data.error?.trim() || "Could not buy label"
        toast.error(msg.length > 600 ? `${msg.slice(0, 600)}…` : msg, { duration: 12_000 })
        return
      }
      if (data.data.quoteVsPaidNote) {
        toast.message("Checkout vs live rate", {
          description: data.data.quoteVsPaidNote,
          duration: 10_000,
        })
      }
      setLabelReady({
        labelUrl: data.data.labelUrl,
        trackingNumber: data.data.trackingNumber,
        orderDisplayNum: data.data.orderDisplayNum,
      })
      setLabelReadyOpen(true)
      toast.success(`Label created for order #${data.data.orderDisplayNum}`)
      await load({ silent: false })
      onResolved?.()
    } catch {
      toast.error("Could not buy label")
    } finally {
      setBusyOrderId(null)
    }
  }

  const dismiss = async (row: FailureRow) => {
    setBusyOrderId(row.order_id)
    try {
      const res = await fetch("/api/admin/shipping/label-failures", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: row.order_id, action: "dismiss" }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? "Could not dismiss")
        return
      }
      toast.success(`Dismissed failure for order #${row.orderDisplayNum}`)
      await load({ silent: false })
      onResolved?.()
    } catch {
      toast.error("Could not dismiss")
    } finally {
      setBusyOrderId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Failed label purchases</h2>
            <NavUnreadCountBadge count={total} />
          </div>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Orders where automated Reswell shipping label purchase failed after checkout. Create a label
            here to attach it to the seller&apos;s sale page, or dismiss if handled another way.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void load({ silent: false })}
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {total > 0 ? (
        <Alert className="rounded-2xl border-destructive/30 bg-destructive/[0.04]">
          <TriangleAlert className="h-4 w-4 text-destructive" />
          <AlertTitle className="font-semibold">
            {total} order{total === 1 ? "" : "s"} need{total === 1 ? "s" : ""} a shipping label
          </AlertTitle>
          <AlertDescription>
            Sellers are waiting on a Reswell-prepared label on their sale page. Use Create label for each
            order below.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-3xl border-border/50 shadow-[0_2px_32px_-18px_rgba(0,0,0,0.12)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Open failures</CardTitle>
          <CardDescription>
            Linked to the exact order — checkout lane uses the same quote path as peer checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No failed label purchases — all clear.</p>
          ) : (
            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Order
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Listing
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Failure
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                      When
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const busy = busyOrderId === row.order_id
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <Link
                              href={`/admin/orders/${row.order_id}`}
                              className="font-mono text-sm font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                            >
                              #{row.orderDisplayNum}
                              <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Seller: {row.seller.display_name?.trim() || row.seller.email || "—"}
                            </p>
                            {row.deliveryStatus ? (
                              <Badge variant="outline" className="text-[10px] rounded-full">
                                {row.deliveryStatus}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top max-w-[200px]">
                          <p className="text-sm font-medium truncate">{row.listingTitle}</p>
                          {row.buyerPaidShippingUsd != null && row.buyerPaidShippingUsd > 0 ? (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              Shipping paid ${row.buyerPaidShippingUsd.toFixed(2)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top max-w-[320px]">
                          <Badge variant="destructive" className="mb-1.5 rounded-full text-[10px]">
                            {stageLabel(row.failure_stage)}
                          </Badge>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {row.error_message}
                          </p>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">
                          <LocalDateTime iso={row.updated_at} dateStyle="medium" timeStyle="short" />
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-full"
                              disabled={busy}
                              onClick={() => void createLabel(row)}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Printer className="h-4 w-4" />
                              )}
                              <span className="ml-2">Create label</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full text-muted-foreground"
                              disabled={busy}
                              onClick={() => void dismiss(row)}
                            >
                              <X className="h-3.5 w-3.5" />
                              <span className="ml-1.5">Dismiss</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={labelReadyOpen} onOpenChange={setLabelReadyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label ready</DialogTitle>
            <DialogDescription>
              Order #{labelReady?.orderDisplayNum} — tracking {labelReady?.trackingNumber}. The seller can
              download this from their sale page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {labelReady?.labelUrl ? (
              <Button asChild>
                <a href={labelReady.labelUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setLabelReadyOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
