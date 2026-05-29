"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Package, LifeBuoy, CircleDollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { format } from "date-fns"
import { AdminIssueRefundButton } from "@/components/features/admin/admin-issue-refund-button"
import { orderStatusBadgeVariant, orderStatusLabel, deliveryStatusLabel, payoutStatusLabel } from "@/lib/order-status"
import { carrierDeliveryPayoutEligibleAt } from "@/lib/shipping/carrier-delivery-payout-hold"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import { createClient } from "@/lib/supabase/client"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"
import { toast } from "sonner"

type OrderApiResponse =
  | {
      data: AdminOrderDetail
      capabilities: { canRefund: boolean; canReleaseShippingSellerEarnings: boolean }
    }
  | { error: string }

type SupportRequest = {
  id: string
  request_type: string
  body: string
  contacted_seller_first: boolean | null
  created_at: string
}

function paymentLabel(method: string): string {
  if (method === "stripe") return "Card (Stripe)"
  if (method === "reswell_bucks") return "Wallet"
  return method
}

function requestTypeLabel(t: string): string {
  switch (t) {
    case "help":
      return "Question"
    case "cancel_order":
      return "Cancel"
    case "refund_help":
      return "Refund help"
    default:
      return t
  }
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<OrderApiResponse | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [releaseBusy, setReleaseBusy] = useState(false)
  const bumpRefetch = useCallback(() => {
    setRefetchKey((k) => k + 1)
  }, [])

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`)
      const body = (await res.json()) as OrderApiResponse & { error?: string }
      if (!res.ok && "error" in body) {
        setPayload({ error: body.error ?? "Could not load order" })
      } else if ("data" in body && body.data && "capabilities" in body && body.capabilities) {
        setPayload({
          data: body.data,
          capabilities: {
            canRefund: body.capabilities.canRefund === true,
            canReleaseShippingSellerEarnings:
              body.capabilities.canReleaseShippingSellerEarnings === true,
          },
        })
      } else {
        setPayload({ error: "Unexpected response" })
      }
    } catch {
      setPayload({ error: "Could not load order" })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder, refetchKey])

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase
      .from("order_support_requests")
      .select("id, request_type, body, contacted_seller_first, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setSupportRequests(data as SupportRequest[])
      })
  }, [id])

  if (!id) {
    return (
      <p className="text-muted-foreground">
        Missing order id. Browse{" "}
        <Link href="/admin/orders" className="underline">
          All orders
        </Link>
        .
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading order…
      </div>
    )
  }

  if (!payload || "error" in payload) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        </Button>
        <p className="text-destructive">{payload && "error" in payload ? payload.error : "Not found"}</p>
      </div>
    )
  }

  const o = payload.data
  const canRefund = payload.capabilities.canRefund
  const canReleaseShippingSellerEarnings =
    payload.capabilities.canReleaseShippingSellerEarnings
  const showLegacyManualPayoutRelease =
    canReleaseShippingSellerEarnings &&
    o.payout?.status === "held" &&
    o.payout.hold_reason !== "awaiting_carrier_settlement" &&
    (o.payout.hold_reason === "awaiting_manual_release" ||
      (o.delivery_status === "delivered" && !o.carrier_delivered_at))
  const displayNum = formatOrderNumForCustomer(o.order_num, o.id)

  async function releaseShippingSellerEarnings() {
    if (!id) return
    setReleaseBusy(true)
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(id)}/release-shipping-seller-earnings`,
        { method: "POST" },
      )
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Could not release earnings")
        return
      }
      toast.success("Payout approved — seller earnings are now available per your rules.")
      bumpRefetch()
    } catch {
      toast.error("Could not release earnings")
    } finally {
      setReleaseBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <OrderDetailRealtimeRefresh orderId={id} onUpdate={bumpRefetch} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Order #{displayNum}</h1>
        <p className="text-muted-foreground text-sm font-mono">{o.id}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-muted-foreground" />
              {o.listing_title ?? "Listing"}
            </CardTitle>
            <CardDescription>
              Created {format(new Date(o.created_at), "MMM d, yyyy HH:mm")}
            </CardDescription>
          </div>
          <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Order total</p>
              <p className="font-medium tabular-nums">${o.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment</p>
              <p className="font-medium">{paymentLabel(o.payment_method)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Item price</p>
              <p className="font-medium tabular-nums">${o.item_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                Shipping{o.shipping_amount > 0 ? " (paid to carrier)" : ""}
              </p>
              <p className="font-medium tabular-nums">${o.shipping_amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Platform fee (7% of item)</p>
              <p className="font-medium tabular-nums">-${o.platform_fee.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Seller earnings (net)</p>
              <p className="font-medium tabular-nums">${o.seller_earnings.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fulfillment</p>
              <p className="font-medium capitalize">{o.fulfillment_method ?? "—"}</p>
            </div>
            {o.refunded_at && (
              <div>
                <p className="text-muted-foreground">Refunded at</p>
                <p className="font-medium">
                  {format(new Date(o.refunded_at), "MMM d, yyyy HH:mm")}
                </p>
              </div>
            )}
          </div>
          {o.shipping_amount > 0 && (
            <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2 leading-relaxed">
              Shipping is collected from the buyer separately from the listing price. It is not
              part of the seller's earnings and the marketplace fee does not apply to it — Reswell
              uses it to cover the carrier label.
            </p>
          )}

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Buyer</p>
            <p className="font-medium">{o.buyer_display_name ?? o.buyer_email ?? o.buyer_id}</p>
            {o.buyer_email && <p className="text-muted-foreground text-xs">{o.buyer_email}</p>}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Seller</p>
            <p className="font-medium">{o.seller_display_name ?? o.seller_email ?? o.seller_id}</p>
            {o.seller_email && <p className="text-muted-foreground text-xs">{o.seller_email}</p>}
          </div>

          {o.fulfillment_method === "shipping" && o.status === "confirmed" && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Shipping & seller payout
              </p>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Delivery status</p>
                  <p className="font-medium">
                    {o.delivery_status ? deliveryStatusLabel(o.delivery_status) : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Tracking</p>
                  <p className="font-mono text-xs break-all">{o.tracking_number ?? "—"}</p>
                </div>
                {o.carrier_delivered_at && (
                  <div>
                    <p className="text-muted-foreground">Carrier delivered</p>
                    <p className="font-medium">
                      {format(new Date(o.carrier_delivered_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                )}
                {o.carrier_delivered_at && o.payout?.status === "held" && (
                  <div>
                    <p className="text-muted-foreground">Auto payout release</p>
                    <p className="font-medium">
                      {format(carrierDeliveryPayoutEligibleAt(new Date(o.carrier_delivered_at)), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                )}
                {o.payout && (
                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <p className="text-muted-foreground">Payout ledger</p>
                      <p className="font-medium">
                        {payoutStatusLabel(o.payout.status, o.payout.hold_reason)}
                      </p>
                    </div>
                    {o.payout.status === "pending" && o.payout.released_at && (
                      <p className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                        <span className="font-medium text-foreground">Admin payout was approved </span>
                        ({format(new Date(o.payout.released_at), "MMM d, yyyy HH:mm")}). The ledger is cleared for
                        cash-out; net earnings should be in the seller&apos;s Reswell wallet as{" "}
                        <span className="font-medium text-foreground">available balance</span> (unless the payment
                        pipeline failed — check wallet activity for this order).
                      </p>
                    )}
                    {o.payout.status === "pending" && !o.payout.released_at && (
                      <p className="text-xs text-amber-950 dark:text-amber-100 leading-relaxed rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
                        Payout row looks inconsistent (pending without a release timestamp). Apply the latest
                        database migrations — the hourly job or an admin legacy release should repair this row.
                      </p>
                    )}
                    {o.payout.status === "held" &&
                      o.payout.hold_reason === "awaiting_carrier_settlement" &&
                      o.carrier_delivered_at && (
                      <p className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                        <span className="font-medium text-foreground">Carrier delivery confirmed. </span>
                        Seller earnings release automatically 24 hours after the carrier delivery timestamp (
                        {format(carrierDeliveryPayoutEligibleAt(new Date(o.carrier_delivered_at)), "MMM d, yyyy HH:mm")}
                        ).
                      </p>
                    )}
                    {showLegacyManualPayoutRelease && (
                      <div className="rounded-md border border-primary/25 bg-primary/[0.04] px-3 py-3 space-y-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Legacy manual release: </span>
                          this order does not use carrier auto-payout. After verifying delivery, use the button below
                          to credit the seller&apos;s wallet.
                        </p>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="gap-2 w-fit"
                          disabled={releaseBusy}
                          onClick={() => void releaseShippingSellerEarnings()}
                        >
                          {releaseBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CircleDollarSign className="h-4 w-4" />
                          )}
                          Approve payout to seller
                        </Button>
                      </div>
                    )}
                    {o.payout.status === "held" &&
                      !showLegacyManualPayoutRelease &&
                      canReleaseShippingSellerEarnings &&
                      o.payout.hold_reason !== "awaiting_carrier_settlement" && (
                      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                        Payout is on hold. Carrier-tracked Reswell shipping orders release automatically 24 hours
                        after ShipEngine reports delivery.
                      </p>
                    )}
                    {o.payout.status === "held" && !canReleaseShippingSellerEarnings && (
                      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                        Only a full admin can use &quot;Approve payout to seller&quot; after delivery is verified.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin actions */}
          {(o.status === "confirmed" || o.status === "refunding") && canRefund && (
            <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin actions</p>
              <div className="flex flex-wrap items-start gap-3">
                <AdminIssueRefundButton
                  orderId={o.id}
                  orderStatus={o.status}
                  amount={o.amount}
                  paymentMethod={o.payment_method}
                  onComplete={bumpRefetch}
                />
              </div>
            </div>
          )}

          {(o.status === "confirmed" || o.status === "refunding") &&
            !canRefund &&
            !showLegacyManualPayoutRelease && (
            <div className="border-t border-border/60 pt-4">
              <p className="text-muted-foreground text-sm">
                Only a full admin can issue refunds. Employees can review this order and escalate.
              </p>
            </div>
          )}

          {o.status === "refunding" && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Refund in progress</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                This order is waiting on Stripe to finish the refund. Buyers and sellers see “Refund in
                progress” on their dashboards. Use sync below if Stripe shows succeeded but this order is
                still stuck.
              </p>
            </div>
          )}

          {o.status === "refunded" && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">Order refunded</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                The buyer received a full refund of ${o.amount.toFixed(2)}
                {o.refunded_at
                  ? ` on ${format(new Date(o.refunded_at), "MMM d, yyyy")}`
                  : ""}
                . Seller earnings have been reversed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support requests for this order */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            Support requests
          </CardTitle>
          <CardDescription>Buyer and seller requests related to this order.</CardDescription>
        </CardHeader>
        <CardContent>
          {supportRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No support requests for this order.</p>
          ) : (
            <div className="space-y-4">
              {supportRequests.map((sr) => (
                <div key={sr.id} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <Badge variant="secondary">{requestTypeLabel(sr.request_type)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(sr.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{sr.body}</p>
                  {sr.request_type === "refund_help" && sr.contacted_seller_first !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Contacted seller first: {sr.contacted_seller_first ? "Yes" : "No"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
