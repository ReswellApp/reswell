"use client"

import Link from "next/link"
import { StripeCardCheckout, stripeCardCheckoutEnabled } from "@/components/stripe-card-checkout"

interface PurchaseOptionsProps {
  listingId: string
  listingTitle: string
  /** Total charged (item + shipping when applicable). */
  price: number
  /** Surfboards with pickup + shipping: which option the buyer selected. */
  fulfillment?: "pickup" | "shipping" | null
  /** Required on server when fulfillment is shipping. */
  shippingAddressId?: string | null
  /** When false, card checkout stays disabled until purchase details are complete. */
  purchaseDetailsReady?: boolean
  /** True when the order ships (includes ship-only listings where fulfillment is undefined). */
  needsShipping?: boolean
}

export function PurchaseOptions({
  listingId,
  listingTitle,
  price,
  fulfillment,
  shippingAddressId,
  purchaseDetailsReady = true,
  needsShipping = false,
}: PurchaseOptionsProps) {
  const showCard = stripeCardCheckoutEnabled()

  if (!showCard) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Card checkout is not configured. Please try again later or{" "}
        <Link href="/help" className="text-primary underline underline-offset-2">
          contact support
        </Link>
        .
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <StripeCardCheckout
        listingId={listingId}
        listingTitle={listingTitle}
        price={price}
        fulfillment={fulfillment ?? null}
        shippingAddressId={shippingAddressId ?? null}
        purchaseDetailsReady={purchaseDetailsReady}
        needsShipping={needsShipping}
      />
      <p className="text-xs text-muted-foreground">Secure payment processed by Stripe.</p>
    </div>
  )
}
