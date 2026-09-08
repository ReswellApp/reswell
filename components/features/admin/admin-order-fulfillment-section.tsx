"use client"

import { format } from "date-fns"
import { MapPin, Package } from "lucide-react"
import { AdminIssueItemReturnPanel } from "@/components/features/admin/admin-issue-item-return-panel"
import { AdminReplaceOrderShippingLabelPanel } from "@/components/features/admin/admin-replace-order-shipping-label-panel"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"
import { SellerPreparedShippingLabelCard } from "@/components/features/sales/seller-prepared-shipping-label-card"
import {
  pickupCodeBannerLabelClassName,
  pickupCodeBannerSurfaceClassName,
} from "@/components/order-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { adminFulfillmentLabel } from "@/lib/admin-order-situation"
import type { AdminOrderDetail, AdminOrderShippingAddress } from "@/lib/db/adminOrders"
import { deliveryStatusLabel } from "@/lib/order-status"

function formatShippingAddress(ship: AdminOrderShippingAddress): string | null {
  if (!ship) return null
  const contactParts = [
    ship.name?.trim(),
    ship.phone?.trim() ? `Phone: ${ship.phone.trim()}` : null,
    ship.email?.trim(),
  ].filter((part) => part && String(part).trim())

  if (!ship.address) {
    return contactParts.length > 0 ? contactParts.join("\n") : null
  }

  const addr = ship.address
  const parts = [
    ...contactParts,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter((part) => part && String(part).trim())
  return parts.length ? parts.join("\n") : null
}

export function AdminOrderFulfillmentSection({
  order,
  canRefund,
  hasShippingLabel,
  hasPaperlessQr,
  paperlessInstructions,
  paperlessHandoffCode,
  canReplaceShippingLabel,
  onComplete,
}: {
  order: AdminOrderDetail
  canRefund: boolean
  hasShippingLabel: boolean
  hasPaperlessQr: boolean
  paperlessInstructions: string | null
  paperlessHandoffCode: string | null
  canReplaceShippingLabel: boolean
  onComplete: () => void
}) {
  const o = order
  const shippingAddressBlock = formatShippingAddress(o.shipping_address)
  const showShippingLabel = o.fulfillment_method === "shipping" && hasShippingLabel
  const showCarrierTracking = o.fulfillment_method === "shipping" && Boolean(o.tracking_number?.trim())
  const displayLineItems =
    o.order_items.length > 0
      ? o.order_items
      : o.listing_title
        ? [{ listing_id: o.listing_id, title: o.listing_title, sort_order: 0 }]
        : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
            Fulfillment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Method</p>
              <p className="font-medium">{adminFulfillmentLabel(o.fulfillment_method)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delivery</p>
              <p className="font-medium">{o.delivery_status ? deliveryStatusLabel(o.delivery_status) : "—"}</p>
            </div>
            {o.carrier_delivered_at ? (
              <div>
                <p className="text-muted-foreground">Carrier delivered</p>
                <p className="font-medium">{format(new Date(o.carrier_delivered_at), "MMM d, yyyy HH:mm")}</p>
              </div>
            ) : null}
          </div>

          {displayLineItems.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {displayLineItems.length > 1 ? "Items" : "Item"}
              </p>
              {displayLineItems.map((item) => (
                <div key={item.listing_id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{item.title ?? "Listing removed"}</p>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{item.listing_id}</p>
                </div>
              ))}
            </div>
          ) : null}

          {shippingAddressBlock ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Ship to
              </p>
              <p className="whitespace-pre-wrap break-words">{shippingAddressBlock}</p>
            </div>
          ) : null}

          {o.fulfillment_method === "pickup" ? (
            o.pickup_code ? (
              <div className={`overflow-hidden rounded-xl border shadow-sm ${pickupCodeBannerSurfaceClassName}`}>
                <div className="p-4">
                  <p className={`mb-2 text-xs font-medium uppercase tracking-wider ${pickupCodeBannerLabelClassName}`}>
                    Buyer pickup code
                  </p>
                  <p className="py-1 text-center font-mono text-3xl font-bold tracking-[0.3em]">{o.pickup_code}</p>
                  <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                    {o.delivery_status === "picked_up"
                      ? "Pickup was verified — seller payout released when the seller confirmed this code."
                      : "The buyer shows this code to the seller at handoff."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                No pickup code on this order (common for in-person register sales).
              </p>
            )
          ) : null}
        </CardContent>
      </Card>

      {showShippingLabel ? (
        <SellerPreparedShippingLabelCard
          orderId={o.id}
          downloadApiPrefix="/api/admin/orders"
          hasPaperlessQr={hasPaperlessQr}
          paperlessInstructions={paperlessInstructions}
          paperlessHandoffCode={paperlessHandoffCode}
        />
      ) : null}

      {canReplaceShippingLabel ? (
        <AdminReplaceOrderShippingLabelPanel
          orderId={o.id}
          canReplace={canReplaceShippingLabel}
          onComplete={onComplete}
        />
      ) : null}

      {showCarrierTracking && o.tracking_number ? (
        <ReswellTrackingSection
          orderId={o.id}
          trackingNumber={o.tracking_number}
          trackingCarrier={o.tracking_carrier}
          marketplaceDeliveryStatus={o.delivery_status ?? "pending"}
          variant="seller"
          carrierTrackingFetchPath={`/api/admin/orders/${encodeURIComponent(o.id)}/carrier-tracking`}
        />
      ) : null}

      {o.fulfillment_method === "shipping" && (o.status === "confirmed" || o.status === "refunding") ? (
        <Card>
          <CardContent className="pt-6">
            <AdminIssueItemReturnPanel
              orderId={o.id}
              canIssue={canRefund && o.status === "confirmed"}
              onComplete={onComplete}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
