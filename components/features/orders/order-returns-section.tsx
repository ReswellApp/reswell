"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  orderItemReturnBadgeVariant,
  orderItemReturnLabel,
} from "@/lib/order-item-return-status"
import { OrderReturnLabelCard } from "@/components/features/orders/order-return-label-card"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"

type ReturnSummary = {
  id: string
  listing_id: string
  status: string
  refund_amount_usd: number
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
  has_label_pdf: boolean
  has_paperless_qr: boolean
  created_at: string
}

export function OrderReturnsSection({
  orderId,
  listingTitlesById,
  audience,
}: {
  orderId: string
  listingTitlesById?: Record<string, string>
  audience: "buyer" | "seller"
}) {
  const [loading, setLoading] = useState(true)
  const [returns, setReturns] = useState<ReturnSummary[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/returns`, {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) {
        setReturns([])
        return
      }
      const body = (await res.json()) as { data?: { returns: ReturnSummary[] } }
      setReturns(body.data?.returns ?? [])
    } catch {
      setReturns([])
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading returns…
      </div>
    )
  }

  if (returns.length === 0) return null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Returns</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {audience === "buyer"
            ? "Authorized returns for this purchase — use the label and QR to ship items back."
            : "Items the buyer is returning to you. Earnings for returned items reverse after delivery settles."}
        </p>
      </div>

      {returns.map((ret) => {
        const title = listingTitlesById?.[ret.listing_id] ?? "Item"
        const deliveryStatus =
          ret.carrier_delivered_at || ret.status === "delivered" || ret.status === "refunded"
            ? "delivered"
            : ret.status === "in_transit"
              ? "shipped"
              : "pending"

        return (
          <div key={ret.id} className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Refund ${ret.refund_amount_usd.toFixed(2)}
                  {ret.status === "refunded"
                    ? " · refunded"
                    : " · refunds ~24h after return delivery"}
                </p>
              </div>
              <Badge variant={orderItemReturnBadgeVariant(ret.status)}>
                {orderItemReturnLabel(ret.status)}
              </Badge>
            </div>

            {ret.has_label_pdf ? (
              <OrderReturnLabelCard
                orderId={orderId}
                returnId={ret.id}
                hasPaperlessQr={ret.has_paperless_qr}
                paperlessInstructions={ret.paperless_instructions}
                paperlessHandoffCode={ret.paperless_handoff_code}
                audience={audience}
              />
            ) : null}

            {ret.tracking_number ? (
              <ReswellTrackingSection
                orderId={orderId}
                trackingNumber={ret.tracking_number}
                trackingCarrier={ret.tracking_carrier}
                marketplaceDeliveryStatus={deliveryStatus}
                carrierTrackingFetchPath={`/api/orders/${encodeURIComponent(orderId)}/returns/${encodeURIComponent(ret.id)}/carrier-tracking`}
                sectionTitle="Return shipment tracking"
                sectionDescription="Live carrier scans for the return package."
                variant={audience}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
