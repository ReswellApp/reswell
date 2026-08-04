"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RotateCcw, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  orderItemReturnBadgeVariant,
  orderItemReturnLabel,
} from "@/lib/order-item-return-status"
import { OrderReturnLabelCard } from "@/components/features/orders/order-return-label-card"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"

type ReturnableLine = {
  orderItemId: string | null
  listingId: string
  title: string
  itemPriceUsd: number
  shippingAmountUsd: number
  sellerEarningsUsd: number
  quantity: number
  alreadyReturned: boolean
  activeReturnId: string | null
}

type RateOption = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

type ReturnRow = {
  id: string
  listing_id: string
  status: string
  refund_amount_usd: number | string
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
  label_pdf_url: string | null
  label_storage_path: string | null
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function lineKey(line: ReturnableLine): string {
  return line.orderItemId ?? `listing:${line.listingId}`
}

export function AdminIssueItemReturnPanel({
  orderId,
  canIssue,
  onComplete,
}: {
  orderId: string
  canIssue: boolean
  onComplete?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState<ReturnableLine[]>([])
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [rates, setRates] = useState<RateOption[]>([])
  const [quoteMeta, setQuoteMeta] = useState<{
    shipFromSummary: string
    shipToSummary: string
    refundAmountUsd: number
    sellerClawbackUsd: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/returns`, {
        cache: "no-store",
        credentials: "include",
      })
      const body = (await res.json()) as {
        data?: { lines: ReturnableLine[]; returns: ReturnRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error || "Could not load returns")
        return
      }
      setLines(body.data?.lines ?? [])
      setReturns(body.data?.returns ?? [])
    } catch {
      toast.error("Could not load returns")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedLine = lines.find((l) => lineKey(l) === selectedKey) ?? null

  async function fetchRates(line: ReturnableLine) {
    setBusy(true)
    setRates([])
    setQuoteMeta(null)
    setSelectedRateId(null)
    setSelectedKey(lineKey(line))
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/returns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rates",
          order_item_id: line.orderItemId ?? undefined,
          listing_id: line.listingId,
        }),
      })
      const body = (await res.json()) as {
        data?: {
          rates: RateOption[]
          shipFromSummary: string
          shipToSummary: string
          refundAmountUsd: number
          sellerClawbackUsd: number
        }
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error || "Could not quote return rates")
        return
      }
      setRates(body.data?.rates ?? [])
      setQuoteMeta(
        body.data
          ? {
              shipFromSummary: body.data.shipFromSummary,
              shipToSummary: body.data.shipToSummary,
              refundAmountUsd: body.data.refundAmountUsd,
              sellerClawbackUsd: body.data.sellerClawbackUsd,
            }
          : null,
      )
      const cheapest = [...(body.data?.rates ?? [])].sort((a, b) => a.amount - b.amount)[0]
      setSelectedRateId(cheapest?.rate_id ?? null)
    } catch {
      toast.error("Could not quote return rates")
    } finally {
      setBusy(false)
    }
  }

  async function purchase() {
    if (!selectedLine || !selectedRateId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/returns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          order_item_id: selectedLine.orderItemId ?? undefined,
          listing_id: selectedLine.listingId,
          rate_id: selectedRateId,
        }),
      })
      const body = (await res.json()) as { data?: { return: ReturnRow }; error?: string }
      if (!res.ok) {
        toast.error(body.error || "Could not purchase return label")
        return
      }
      toast.success("Return authorized — label created for the buyer")
      setSelectedKey(null)
      setRates([])
      setQuoteMeta(null)
      await load()
      onComplete?.()
    } catch {
      toast.error("Could not purchase return label")
    } finally {
      setBusy(false)
    }
  }

  async function confirmReceipt(returnId: string) {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/returns/${encodeURIComponent(returnId)}/confirm-receipt`,
        { method: "POST", credentials: "include" },
      )
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(body.error || "Could not confirm receipt")
        return
      }
      toast.success("Return marked received — refund clock started")
      await load()
      onComplete?.()
    } catch {
      toast.error("Could not confirm receipt")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading item returns…
      </div>
    )
  }

  if (lines.length === 0 && returns.length === 0) return null

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Item returns
        </p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Authorize a return for one item: buy a prepaid return label (buyer → seller), mark the item
          returned, and refund automatically 24 hours after return delivery.
        </p>
      </div>

      <div className="space-y-2">
        {lines.map((line) => {
          const active = returns.find((r) => r.id === line.activeReturnId) ?? null
          return (
            <div
              key={lineKey(line)}
              className="rounded-md border border-border/70 bg-background px-3 py-3 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{line.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {money(line.itemPriceUsd)} item
                    {line.shippingAmountUsd > 0 ? ` + ${money(line.shippingAmountUsd)} shipping` : ""}
                    {" · "}
                    seller clawback {money(line.sellerEarningsUsd)}
                    {line.quantity > 1 ? ` · qty ${line.quantity}` : ""}
                  </p>
                </div>
                {active ? (
                  <Badge variant={orderItemReturnBadgeVariant(active.status)}>
                    {orderItemReturnLabel(active.status)}
                  </Badge>
                ) : canIssue && !line.alreadyReturned ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void fetchRates(line)}
                  >
                    Issue return
                  </Button>
                ) : null}
              </div>

              {selectedKey === lineKey(line) && quoteMeta ? (
                <div className="space-y-3 border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    From (buyer): {quoteMeta.shipFromSummary}
                    <br />
                    To (seller): {quoteMeta.shipToSummary}
                    <br />
                    Refund after delivery: {money(quoteMeta.refundAmountUsd)} · clawback{" "}
                    {money(quoteMeta.sellerClawbackUsd)}
                  </p>
                  {rates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {busy ? "Loading rates…" : "No rates available."}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rates.map((rate) => (
                        <li key={rate.rate_id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm has-[:checked]:border-primary">
                            <input
                              type="radio"
                              name={`return-rate-${lineKey(line)}`}
                              checked={selectedRateId === rate.rate_id}
                              onChange={() => setSelectedRateId(rate.rate_id)}
                            />
                            <span className="flex-1">
                              {rate.carrierLabel} · {rate.serviceName}
                            </span>
                            <span className="tabular-nums font-medium">
                              {money(rate.amount)} {rate.currency}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !selectedRateId}
                    onClick={() => void purchase()}
                    className="gap-2"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                    Purchase return label
                  </Button>
                </div>
              ) : null}

              {active ? (
                <div className="space-y-3 border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground">
                    Refund {money(Number(active.refund_amount_usd))}
                    {active.tracking_number
                      ? ` · ${active.tracking_carrier ?? "Carrier"} ${active.tracking_number}`
                      : ""}
                    {active.carrier_delivered_at
                      ? ` · delivered ${new Date(active.carrier_delivered_at).toLocaleString()}`
                      : ""}
                  </p>
                  {(active.label_pdf_url || active.label_storage_path) && (
                    <OrderReturnLabelCard
                      orderId={orderId}
                      returnId={active.id}
                      apiPrefix="/api/admin/orders"
                      hasPaperlessQr={Boolean(
                        active.paperless_qr_url || active.paperless_qr_storage_path,
                      )}
                      paperlessInstructions={active.paperless_instructions}
                      paperlessHandoffCode={active.paperless_handoff_code}
                      audience="admin"
                    />
                  )}
                  {canIssue &&
                    !active.carrier_delivered_at &&
                    active.status !== "refunded" &&
                    active.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void confirmReceipt(active.id)}
                      >
                        Confirm receipt
                      </Button>
                    )}
                  {active.tracking_number ? (
                    <ReswellTrackingSection
                      orderId={orderId}
                      trackingNumber={active.tracking_number}
                      trackingCarrier={active.tracking_carrier}
                      marketplaceDeliveryStatus={
                        active.carrier_delivered_at || active.status === "delivered"
                          ? "delivered"
                          : active.status === "in_transit"
                            ? "shipped"
                            : "pending"
                      }
                      carrierTrackingFetchPath={`/api/admin/orders/${encodeURIComponent(orderId)}/returns/${encodeURIComponent(active.id)}/carrier-tracking`}
                      sectionTitle="Return shipment tracking"
                      sectionDescription="Live carrier scans for the buyer’s return package."
                      variant="seller"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
