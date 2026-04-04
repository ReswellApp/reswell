"use client"

import { CheckoutWithCard } from "@/components/checkout-with-card"

interface PurchaseOptionsProps {
  listingId: string
  listingTitle: string
  /** Total charged (item + shipping when applicable). */
  price: number
  sellerId: string
  /** Surfboards with pickup + shipping: which option the buyer selected. */
  fulfillment?: "pickup" | "shipping" | null
  itemPrice?: number
  shippingAmount?: number
  /** When purchasing from an accepted offer, pass the offer ID. */
  offerId?: string
}

export function PurchaseOptions({
  listingId,
  listingTitle,
  price,
  fulfillment,
  offerId,
}: PurchaseOptionsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Pay with</p>
      <CheckoutWithCard
        listingId={listingId}
        listingTitle={listingTitle}
        price={price}
        fulfillment={fulfillment}
        offerId={offerId}
      />
    </div>
  )
}
