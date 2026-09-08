"use client"

import { format } from "date-fns"
import { CircleDollarSign, Loader2 } from "lucide-react"
import { AdminIssueRefundButton } from "@/components/features/admin/admin-issue-refund-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { adminPaymentLabel } from "@/lib/admin-order-situation"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import { payoutStatusLabel } from "@/lib/order-status"
import { carrierDeliveryPayoutEligibleAt } from "@/lib/shipping/carrier-delivery-payout-hold"

function MoneyRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-sm tabular-nums ${muted ? "text-muted-foreground" : "font-medium text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}

export function AdminOrderMoneySection({
  order,
  canRefund,
  canReleaseShippingSellerEarnings,
  showLegacyManualPayoutRelease,
  releaseBusy,
  onReleasePayout,
  onComplete,
}: {
  order: AdminOrderDetail
  canRefund: boolean
  canReleaseShippingSellerEarnings: boolean
  showLegacyManualPayoutRelease: boolean
  releaseBusy: boolean
  onReleasePayout: () => void
  onComplete: () => void
}) {
  const o = order
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <MoneyRow label="Order total" value={`$${o.amount.toFixed(2)}`} />
          <MoneyRow label="Item" value={`$${o.item_price.toFixed(2)}`} />
          <MoneyRow
            label={o.shipping_amount > 0 ? "Shipping (to carrier)" : "Shipping"}
            value={`$${o.shipping_amount.toFixed(2)}`}
          />
          {o.promo_discount_usd > 0 ? (
            <MoneyRow label="Promo" value={`-$${o.promo_discount_usd.toFixed(2)}`} muted />
          ) : null}
          <MoneyRow label="Platform fee" value={`-$${o.platform_fee.toFixed(2)}`} muted />
          <MoneyRow label="Seller earnings" value={`$${o.seller_earnings.toFixed(2)}`} />
          <MoneyRow label="Paid with" value={adminPaymentLabel(o.payment_method)} />
        </div>

        {o.shipping_amount > 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Shipping is collected from the buyer to cover the carrier label. It is not part of seller
            earnings and has no marketplace fee.
          </p>
        ) : null}

        {o.payout ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seller payout</p>
            <p className="text-sm font-medium text-foreground">
              {payoutStatusLabel(o.payout.status, o.payout.hold_reason)}
            </p>
            {o.carrier_delivered_at && o.payout.status === "held" && o.payout.hold_reason === "awaiting_carrier_settlement" ? (
              <p className="text-xs text-muted-foreground">
                Auto-releases{" "}
                {format(carrierDeliveryPayoutEligibleAt(new Date(o.carrier_delivered_at)), "MMM d, yyyy HH:mm")}
              </p>
            ) : null}
            {o.payout.status === "pending" && o.payout.released_at ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Approved {format(new Date(o.payout.released_at), "MMM d, yyyy HH:mm")}. Net earnings should be in
                the seller wallet as available balance.
              </p>
            ) : null}
            {o.payout.status === "pending" && !o.payout.released_at ? (
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                Payout row looks inconsistent (pending without a release timestamp). Apply the latest
                database migrations — the hourly job or a legacy release should repair this.
              </p>
            ) : null}
            {showLegacyManualPayoutRelease ? (
              <div className="space-y-2 pt-1">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This order does not use carrier auto-payout. After verifying delivery, approve the seller
                  payout.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={releaseBusy}
                  onClick={onReleasePayout}
                >
                  {releaseBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                  Approve payout to seller
                </Button>
              </div>
            ) : null}
            {o.payout.status === "held" &&
            !showLegacyManualPayoutRelease &&
            canReleaseShippingSellerEarnings &&
            o.payout.hold_reason !== "awaiting_carrier_settlement" ? (
              <p className="text-xs text-muted-foreground">
                Payout is on hold. Carrier-tracked shipping orders release automatically 24 hours after
                delivery.
              </p>
            ) : null}
            {o.payout.status === "held" && !canReleaseShippingSellerEarnings ? (
              <p className="text-xs text-muted-foreground">
                Only a full admin can approve a manual seller payout.
              </p>
            ) : null}
          </div>
        ) : null}

        {o.refunded_at ? (
          <p className="text-sm text-muted-foreground">
            Refunded {format(new Date(o.refunded_at), "MMM d, yyyy HH:mm")}
          </p>
        ) : null}

        {(o.status === "confirmed" || o.status === "refunding") && canRefund ? (
          <div className="border-t border-border/70 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Refund</p>
            <AdminIssueRefundButton
              orderId={o.id}
              orderStatus={o.status}
              amount={o.amount}
              shippingAmount={o.shipping_amount}
              paymentMethod={o.payment_method}
              onComplete={onComplete}
            />
          </div>
        ) : null}

        {(o.status === "confirmed" || o.status === "refunding") && !canRefund && !showLegacyManualPayoutRelease ? (
          <p className="text-sm text-muted-foreground">
            Only a full admin can issue refunds. Employees can review this order and escalate.
          </p>
        ) : null}

        {o.stripe_checkout_session_id ? (
          <div>
            <p className="text-xs text-muted-foreground">Stripe checkout session</p>
            <p className="break-all font-mono text-[11px] text-muted-foreground">{o.stripe_checkout_session_id}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
