"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LocalDateTime } from "@/components/ui/local-datetime"
import {
  adjustmentDisputeStatusLabel,
  formatAdjustmentUsd,
  type AdjustmentDisputeStatus,
} from "@/lib/shipping/adjustment-fee"

type DisputeRow = {
  id: string
  order_id: string | null
  created_at: string
  status: AdjustmentDisputeStatus
  amountUsd: number
  orderDisplayNum: string | null
  sellerName: string | null
  carrierLabel: string
}

export function AdminAdjustmentDisputesTab() {
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/shipping/adjustment-disputes?status=open&limit=100", {
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: DisputeRow[]
        error?: string
      }
      if (!res.ok) throw new Error(body.error || "Could not load disputes")
      setRows(body.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load disputes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function updateDispute(
    disputeId: string,
    action: "submit_to_carrier" | "resolve" | "deny",
  ) {
    const note =
      action === "submit_to_carrier"
        ? window.prompt("Note for the seller (optional)") ?? ""
        : window.prompt(action === "resolve" ? "What was the outcome?" : "Why is this denied?")
    if (note == null) return
    if (action !== "submit_to_carrier" && note.trim().length < 2) {
      toast.error("Add a short note for the seller.")
      return
    }
    const carrierReference =
      action === "submit_to_carrier"
        ? window.prompt("Carrier reference number, if you have one") ?? ""
        : ""
    setBusyId(disputeId)
    try {
      const res = await fetch("/api/admin/shipping/adjustment-disputes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          disputeId,
          note: note.trim() || undefined,
          carrierReference: carrierReference.trim() || undefined,
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error || "Could not update the dispute")
      toast.success(
        action === "submit_to_carrier" ? "Marked submitted to the carrier" : "Dispute updated",
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the dispute")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Adjustment fee disputes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sellers send UPS, FedEx, and USPS disputes to Reswell. After you file with the carrier,
            mark it submitted here.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load disputes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opened</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading disputes…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No open adjustment fee disputes.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    <LocalDateTime iso={row.created_at} />
                  </TableCell>
                  <TableCell className="text-sm font-medium">{row.carrierLabel}</TableCell>
                  <TableCell className="tabular-nums">{formatAdjustmentUsd(row.amountUsd)}</TableCell>
                  <TableCell>
                    {row.order_id ? (
                      <Link href={`/admin/orders/${row.order_id}`} className="text-sm underline-offset-4 hover:underline">
                        {row.orderDisplayNum ? `#${row.orderDisplayNum}` : row.order_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-sm">{row.sellerName || "Seller"}</TableCell>
                  <TableCell className="text-xs">{adjustmentDisputeStatusLabel(row.status)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {row.status === "submitted_to_reswell" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => void updateDispute(row.id, "submit_to_carrier")}
                      >
                        Submit to {row.carrierLabel}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() => void updateDispute(row.id, "resolve")}
                    >
                      Resolve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === row.id}
                      onClick={() => void updateDispute(row.id, "deny")}
                    >
                      Deny
                    </Button>
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
