"use client"

import { BuyWithBucks } from "@/components/buy-with-bucks"
import { CheckoutWithCard } from "@/components/checkout-with-card"
import { Separator } from "@/components/ui/separator"

interface PurchaseOptionsProps {
  listingId: string
  listingTitle: string
  price: number
  sellerId: string
}

export function PurchaseOptions({
  listingId,
  listingTitle,
  price,
  sellerId,
}: PurchaseOptionsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Pay with</p>
      <CheckoutWithCard
        listingId={listingId}
        listingTitle={listingTitle}
        price={price}
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
      />
    </div>
  )
}
