"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PurchaseOptions } from "@/components/purchase-options"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { resolvePayableAmount, type PayableListing } from "@/lib/purchase-amount"
import { Truck, MapPin } from "lucide-react"

export type BoardCheckoutListing = PayableListing & {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
}

interface BoardCheckoutClientProps {
  listing: BoardCheckoutListing
}

export function BoardCheckoutClient({ listing }: BoardCheckoutClientProps) {
  const canPick = listing.local_pickup !== false
  const canShip = !!listing.shipping_available

  const [method, setMethod] = useState<"pickup" | "shipping">(() => {
    if (canPick && !canShip) return "pickup"
    if (!canPick && canShip) return "shipping"
    return "pickup"
  })

  const fulfillmentForApi = canPick && canShip ? method : undefined

  const resolved = useMemo(() => {
    const f =
      canPick && canShip ? method : !canPick && canShip ? "shipping" : "pickup"
    return resolvePayableAmount(listing, f)
  }, [listing, method, canPick, canShip])

  if (!resolved.ok) {
    return (
      <p className="text-sm text-destructive">
        This listing cannot be checked out ({resolved.error}).{" "}
        <Link href={`/boards/${listing.slug || listing.id}`} className="underline">
          Back to listing
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
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
                  Meet the seller and inspect the board in person.
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
          <span className="text-muted-foreground">Board</span>
          <span>${resolved.itemPrice.toFixed(2)}</span>
        </div>
        {resolved.shipping > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>${resolved.shipping.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total</span>
          <span>${resolved.total.toFixed(2)}</span>
        </div>
      </div>

      <PurchaseOptions
        listingId={listing.id}
        listingTitle={listing.title}
        sellerId={listing.user_id}
        price={resolved.total}
        itemPrice={resolved.itemPrice}
        shippingAmount={resolved.shipping}
        fulfillment={fulfillmentForApi}
      />
    </div>
  )
}
