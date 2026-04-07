"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { CheckoutPurchaseDetails, type PurchaseDetailsState } from "@/components/checkout-purchase-details"
import { PurchaseOptions } from "@/components/purchase-options"
import { ProtectionTrustBlock } from "@/components/protection-trust-block"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { resolvePayableAmount, type PayableListing } from "@/lib/purchase-amount"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { sellerProfileHref } from "@/lib/seller-slug"
import { ImageOff, Truck, MapPin } from "lucide-react"

const SURFBOARD_COPY = {
  itemLineLabel: "Board",
  inspectNoun: "board",
  priceContextNoun: "board",
} as const

/** Line-item labels for peer surfboard checkout (optional overrides). */
export type CheckoutCopy = {
  itemLineLabel: string
  inspectNoun: string
  /** e.g. "board" / "item" — used in "the ___ price only" */
  priceContextNoun: string
}

export type CheckoutListing = PayableListing & {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
  listing_images?: Array<{ url: string; is_primary: boolean | null }> | null
}

export type CheckoutSeller = {
  display_name: string | null
  avatar_url: string | null
  seller_slug: string | null
  shop_name: string | null
  is_shop: boolean | null
}

function primaryListingImageUrl(images: CheckoutListing["listing_images"]): string | null {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
}

interface CheckoutClientProps {
  listing: CheckoutListing
  /** Optional overrides for checkout headings and helper text (peer surfboard flow). */
  copy?: CheckoutCopy
  buyerEmail?: string | null
  initialAddresses: ProfileAddressRow[]
  seller?: CheckoutSeller | null
}

function sellerDisplayName(s: CheckoutSeller) {
  if (s.is_shop && s.shop_name?.trim()) return s.shop_name.trim()
  return s.display_name?.trim() || "Seller"
}

function sellerInitials(s: CheckoutSeller) {
  const n = sellerDisplayName(s)
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return n.slice(0, 2).toUpperCase() || "?"
}

export function CheckoutClient({
  listing,
  copy = SURFBOARD_COPY,
  buyerEmail,
  initialAddresses,
  seller,
}: CheckoutClientProps) {
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

  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetailsState>({
    readyToPay: false,
    shippingAddressId: null,
  })

  const handlePurchaseDetailsChange = useCallback((state: PurchaseDetailsState) => {
    setPurchaseDetails(state)
  }, [])

  const backHref = listingDetailHref(listing)
  const imageUrl = primaryListingImageUrl(listing.listing_images)
  const needsShipping = impliedFulfillment === "shipping"

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

  const paymentBlocked = !purchaseDetails.readyToPay

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start">
      {/* Left: purchase details → fulfillment → payment (second on mobile) */}
      <div className="order-2 lg:order-1 space-y-6">
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

        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Purchase details</h2>
          <p className="text-sm text-muted-foreground">
            {needsShipping
              ? "Email, name, and where to ship. Add an address below if you don’t have one saved."
              : "Email and contact name for your order."}
          </p>
        </div>

        <CheckoutPurchaseDetails
          buyerEmail={buyerEmail ?? null}
          initialAddresses={initialAddresses}
          needsShipping={needsShipping}
          onStateChange={handlePurchaseDetailsChange}
        />

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Payment</h2>
          <PurchaseOptions
            listingId={listing.id}
            listingTitle={listing.title}
            price={resolved.total}
            fulfillment={fulfillmentForApi}
            shippingAddressId={needsShipping ? purchaseDetails.shippingAddressId : null}
            purchaseDetailsReady={!paymentBlocked}
            needsShipping={needsShipping}
          />
        </div>
      </div>

      {/* Right: seller + listing + summary + delivery + protection (first on mobile) */}
      <div className="order-1 lg:order-2 space-y-6">
        {seller && (
          <Link
            href={sellerProfileHref(seller)}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <Avatar className="h-12 w-12 shrink-0 border border-border">
              <AvatarImage src={seller.avatar_url || undefined} alt={sellerDisplayName(seller)} />
              <AvatarFallback className="text-sm font-medium">{sellerInitials(seller)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Seller</p>
              <p className="font-semibold text-foreground truncate">{sellerDisplayName(seller)}</p>
              <p className="text-xs text-primary mt-0.5">View profile</p>
            </div>
          </Link>
        )}

        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-snug">{capitalizeWords(listing.title)}</h2>
          <p className="text-sm text-muted-foreground">Order summary</p>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={capitalizeWords(listing.title)}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 480px"
              priority
            />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-10 w-10 opacity-50" aria-hidden />
              <span className="text-sm">No photo</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{copy.itemLineLabel}</span>
            <span className="tabular-nums text-foreground font-medium">${resolved.itemPrice.toFixed(2)}</span>
          </div>
          {deliverySelected && resolved.shipping > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums text-foreground font-medium">${resolved.shipping.toFixed(2)}</span>
            </div>
          )}
          {deliverySelected && resolved.shipping === 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>Free</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base border-t border-border pt-2 mt-1">
            <span>Total</span>
            <span className="tabular-nums text-foreground">${resolved.total.toFixed(2)}</span>
          </div>
        </div>

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
                      shipping set by the seller — included in your total. Coordinate delivery details with the
                      seller in messages after you pay.
                    </>
                  ) : (
                    <>
                      <span className="text-foreground font-medium">Free shipping</span> from this seller. Your
                      total is the {copy.priceContextNoun} price only; confirm the shipping address with the seller
                      in messages after you pay.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {impliedFulfillment === "shipping" && <ProtectionTrustBlock />}
      </div>
    </div>
  )
}
