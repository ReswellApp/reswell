"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PurchaseOptions } from "@/components/purchase-options"
import { ProtectionTrustBlock } from "@/components/protection-trust-block"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { resolvePayableAmount, type PayableListing } from "@/lib/purchase-amount"
import { listingDetailHref } from "@/lib/listing-href"
import { Truck, MapPin } from "lucide-react"

const SURFBOARD_COPY = {
  itemLineLabel: "Board",
  inspectNoun: "board",
  priceContextNoun: "board",
} as const

export type PeerListingCheckoutCopy = {
  itemLineLabel: string
  inspectNoun: string
  /** e.g. "board" / "item" — used in "the ___ price only" */
  priceContextNoun: string
}

export type BoardCheckoutListing = PayableListing & {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
}

interface BoardCheckoutClientProps {
  listing: BoardCheckoutListing
  /** Surfboard wording by default; pass used-gear labels for `/checkout/listing` (used gear). */
  copy?: PeerListingCheckoutCopy
  /** When checking out from an accepted offer, pass the offer ID to associate with the purchase. */
  offerId?: string
}

export function BoardCheckoutClient({ listing, copy = SURFBOARD_COPY, offerId }: BoardCheckoutClientProps) {
  const canPick = listing.local_pickup !== false
  const canShip = !!listing.shipping_available

  const [method, setMethod] = useState<"pickup" | "shipping">(() => {
    if (canPick && !canShip) return "pickup"
    if (!canPick && canShip) return "shipping"
    return "pickup"
  })

  const fulfillmentForApi = canPick && canShip ? method : undefined

  const impliedFulfillment: "pickup" | "shipping" =
    canPick && canShip ? method : !canPick && canShip ? "shipping" : "pickup"

  const resolved = useMemo(() => {
    return resolvePayableAmount(listing, impliedFulfillment)
  }, [listing, impliedFulfillment])

  const backHref = listingDetailHref(listing)

  if (!resolved.ok) {
    return (
      <p className="text-sm text-destructive">
        This listing cannot be checked out ({resolved.error}).{" "}
        <Link href={backHref} className="underline">
          Back to listing
        </Link>
      </p>
    )
  }

  const deliverySelected = impliedFulfillment === "shipping"

  return (
    <div className="space-y-6">
      {!canPick && canShip && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <Truck className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
            <div className="text-sm min-w-0">
              <p className="font-medium">Delivery</p>
              <p className="text-muted-foreground mt-1">
                {resolved.shipping > 0 ? (
                  <>
                    Flat{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      ${resolved.shipping.toFixed(2)}
                    </span>{" "}
                    shipping set by the seller — included in your total below. Coordinate delivery
                    details with the seller in messages after you pay.
                  </>
                ) : (
                  <>
                    <span className="text-foreground font-medium">Free shipping</span> from this
                    seller. Your total below is the {copy.priceContextNoun} price only; confirm the
                    shipping address with the seller in messages after you pay.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {canPick && canShip && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <Label className="text-base">How do you want to receive it?</Label>
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as "pickup" | "shipping")}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
                method === "pickup" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <RadioGroupItem value="pickup" id="fulfill-pickup" className="mt-1" />
              <div>
                <span className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Local pickup
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Meet the seller and inspect the {copy.inspectNoun} in person.
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
                method === "shipping" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <RadioGroupItem value="shipping" id="fulfill-ship" className="mt-1" />
              <div>
                <span className="font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Ship to me
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {resolved.shipping > 0
                    ? `Includes $${resolved.shipping.toFixed(2)} shipping (set by seller).`
                    : "Seller offers free shipping."}
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{copy.itemLineLabel}</span>
          <span className="tabular-nums text-black dark:text-white font-medium">${resolved.itemPrice.toFixed(2)}</span>
        </div>
        {deliverySelected && resolved.shipping > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span className="tabular-nums text-black dark:text-white font-medium">${resolved.shipping.toFixed(2)}</span>
          </div>
        )}
        {deliverySelected && resolved.shipping === 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>Free</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total</span>
          <span className="tabular-nums text-black dark:text-white">${resolved.total.toFixed(2)}</span>
        </div>
      </div>

      {impliedFulfillment === "shipping" && <ProtectionTrustBlock />}

      <PurchaseOptions
        listingId={listing.id}
        listingTitle={listing.title}
        price={resolved.total}
        fulfillment={fulfillmentForApi}
        offerId={offerId}
      />
    </div>
  )
}
