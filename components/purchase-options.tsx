"use client"

import { BuyWithBucks } from "@/components/buy-with-bucks"
import { CheckoutWithCard } from "@/components/checkout-with-card"
import { Separator } from "@/components/ui/separator"

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
  sellerId,
  fulfillment,
  itemPrice,
  shippingAmount,
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
      <div className="relative">
        <Separator className="absolute inset-0 flex items-center" />
        <span className="relative flex justify-center text-xs uppercase text-muted-foreground bg-background px-2">
          or
        </span>
      </div>
      <BuyWithBucks
        listingId={listingId}
        listingTitle={listingTitle}
        price={price}
        sellerId={sellerId}
        fulfillment={fulfillment}
        itemPrice={itemPrice}
        shippingAmount={shippingAmount}
        offerId={offerId}
      />
    </div>
  )
}
