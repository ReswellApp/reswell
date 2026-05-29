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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, ExternalLink, Loader2, Printer, RefreshCw, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { downloadFailuresCsv } from "./shipping-export"

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
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
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
      setSelected(new Set())
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

  const stagesPresent = [...new Set(rows.map((r) => r.failure_stage))]
  const visibleRows = stageFilter === "all" ? rows : rows.filter((r) => r.failure_stage === stageFilter)
  const visibleIds = visibleRows.map((r) => r.order_id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const selectedRows = rows.filter((r) => selected.has(r.order_id))

  const toggleRow = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }

  const bulkDismiss = async () => {
    const ids = selectedRows.map((r) => r.order_id)
    if (ids.length === 0) return
    if (typeof window !== "undefined" && !window.confirm(`Dismiss ${ids.length} failed label(s)?`)) {
      return
    }
    setBulkBusy(true)
    try {
      const res = await fetch("/api/admin/shipping/label-failures", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, action: "dismiss" }),
      })
      const body = (await res.json()) as { dismissed?: number; error?: string }
      if (!res.ok) {
        toast.error(body.error ?? "Could not dismiss failures")
        return
      }
      toast.success(`Dismissed ${body.dismissed ?? ids.length} failure(s)`)
      await load({ silent: false })
      onResolved?.()
    } catch {
      toast.error("Could not dismiss failures")
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkCreate = async () => {
    const targets = selectedRows
    if (targets.length === 0) return
    setBulkBusy(true)
    setBulkProgress({ done: 0, total: targets.length })
    let ok = 0
    let failed = 0
    for (let i = 0; i < targets.length; i += 1) {
      const row = targets[i]
      try {
        const res = await fetch("/api/admin/shipping/order-label", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: row.order_id, action: "purchase_checkout_lane" }),
        })
        if (res.ok) ok += 1
        else failed += 1
      } catch {
        failed += 1
      }
      setBulkProgress({ done: i + 1, total: targets.length })
    }
    setBulkBusy(false)
    setBulkProgress(null)
    if (ok > 0) toast.success(`Created ${ok} label(s)`)
    if (failed > 0) toast.error(`${failed} label(s) failed — review the remaining rows`)
    await load({ silent: false })
    onResolved?.()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Failed label purchases</h2>
            <NavUnreadCountBadge count={total} />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Orders where automated Reswell shipping label purchase failed after checkout. Create a label
            here to attach it to the seller&apos;s sale page, or dismiss if handled another way.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stagesPresent.length > 1 ? (
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-9 w-[180px] rounded-full text-sm">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {stagesPresent.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => downloadFailuresCsv(rows)}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
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
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            disabled={bulkBusy}
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
          {bulkBusy && bulkProgress ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {bulkProgress.done}/{bulkProgress.total}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => void bulkCreate()}
              disabled={bulkBusy}
            >
              <Printer className="h-4 w-4" />
              Create labels
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 text-muted-foreground"
              onClick={() => void bulkDismiss()}
              disabled={bulkBusy}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

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

      <Card className="rounded-2xl border-border bg-card">
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAllVisible}
                        aria-label="Select all"
                        disabled={bulkBusy || visibleIds.length === 0}
                      />
                    </TableHead>
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
                  {visibleRows.map((row) => {
                    const busy = busyOrderId === row.order_id
                    return (
                      <TableRow key={row.id} data-state={selected.has(row.order_id) ? "selected" : undefined}>
                        <TableCell className="align-top">
                          <Checkbox
                            checked={selected.has(row.order_id)}
                            onCheckedChange={() => toggleRow(row.order_id)}
                            aria-label={`Select order ${row.orderDisplayNum}`}
                            disabled={bulkBusy}
                          />
                        </TableCell>
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
                              disabled={busy || bulkBusy}
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
                              disabled={busy || bulkBusy}
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
