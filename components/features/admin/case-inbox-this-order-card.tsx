import Link from "next/link"
import { format } from "date-fns"
import { CreditCard, Package, Truck } from "lucide-react"
import type { CaseInboxThisOrderSnapshot } from "@/lib/admin/case-customer-panel"
import { formatCustomerUsd } from "@/lib/admin/case-customer-panel"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  deliveryStatusLabel,
  orderStatusLabel,
} from "@/lib/order-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface CaseInboxThisOrderCardProps {
  linkedOrderId: string | null
  linkedOrderRef: string | null
  order: CaseInboxThisOrderSnapshot | null
}

export function CaseInboxThisOrderCard({
  linkedOrderId,
  linkedOrderRef,
  order,
}: CaseInboxThisOrderCardProps) {
  if (!linkedOrderId && !order) {
    return (
      <section className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          This order
        </p>
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
          Not linked. Connect one from past orders below.
        </p>
      </section>
    )
  }

  const orderId = order?.id ?? linkedOrderId
  const orderLabel = formatOrderNumForCustomer(order?.orderRef ?? linkedOrderRef, orderId ?? "")
  const shipLine = order
    ? [
        order.trackingCarrier || "Carrier",
        order.trackingNumber || "No tracking yet",
        order.carrierDeliveredAt
          ? `delivered ${format(new Date(order.carrierDeliveredAt), "MMM d, yyyy")}`
          : order.deliveryStatus
            ? deliveryStatusLabel(order.deliveryStatus)
            : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          This order
        </p>
        {orderId ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" asChild>
            <Link href={`/admin/orders/${orderId}`}>
              <Package className="mr-1 h-3 w-3" aria-hidden />
              Full order
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold">{orderLabel}</p>
          {order ? (
            <Badge variant="secondary" className="h-5 font-normal">
              {orderStatusLabel(order.status)}
            </Badge>
          ) : (
            <p className="text-[11px] text-muted-foreground">Pay and ship unavailable.</p>
          )}
        </div>
        {order?.listingTitle ? (
          <p className="truncate text-xs text-foreground">{order.listingTitle}</p>
        ) : null}
        {order ? (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <CreditCard className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                {formatCustomerUsd(order.amount)}
                {order.shippingAmount > 0
                  ? ` · ${formatCustomerUsd(order.itemPrice)} item + ${formatCustomerUsd(order.shippingAmount)} ship`
                  : ""}
                {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
                {order.refundedAt ? " · refunded" : ""}
                {order.payoutStatus
                  ? ` · payout ${order.payoutStatus}${order.payoutHoldReason ? ` (${order.payoutHoldReason})` : ""}`
                  : ""}
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <Truck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                {order.fulfillmentMethod === "local_pickup"
                  ? `Local pickup${order.pickupCode ? ` · code ${order.pickupCode}` : ""}`
                  : shipLine}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
