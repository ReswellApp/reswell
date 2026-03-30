import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MessageCircle, Package, Truck, MapPin } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { OrderProtectionWidget } from "@/components/order-protection-widget"
import { isProtectionWindowActive, daysRemainingInWindow } from "@/lib/protection-constants"

type ShippingAddressJson = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

type PurchaseDetail = {
  id: string
  amount: number | string
  status: string
  created_at: string
  fulfillment_method: string | null
  shipping_address: ShippingAddressJson
  stripe_checkout_session_id: string | null
  seller_id: string
  listing_id: string
  listings:
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{ url: string; is_primary: boolean | null }> | null
      }
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        listing_images: Array<{ url: string; is_primary: boolean | null }> | null
      }[]
    | null
}

function primaryImage(images: Array<{ url: string; is_primary: boolean | null }> | null | undefined) {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
}

function formatAddress(addr: NonNullable<ShippingAddressJson>["address"]) {
  if (!addr) return null
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter((p) => p && String(p).trim())
  return parts.length ? parts.join("\n") : null
}

export default async function PurchaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: row, error } = await supabase
    .from("purchases")
    .select(
      `
      id,
      amount,
      status,
      created_at,
      fulfillment_method,
      shipping_address,
      stripe_checkout_session_id,
      seller_id,
      listing_id,
      listings (
        id,
        title,
        slug,
        section,
        listing_images ( url, is_primary )
      )
    `
    )
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle()

  if (error || !row) {
    notFound()
  }

  const purchase = row as unknown as PurchaseDetail
  const listing = Array.isArray(purchase.listings) ? purchase.listings[0] : purchase.listings
  const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
  const img = primaryImage(listing?.listing_images ?? null)
  const listingHref = listing ? listingDetailHref(listing) : null

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", purchase.seller_id)
    .maybeSingle()

  // Fetch protection eligibility for this purchase
  const { data: eligibility } = await supabase
    .from("protection_eligibility")
    .select("is_eligible, reason, window_closes")
    .eq("order_id", id)
    .maybeSingle()

  const { data: existingClaim } = await supabase
    .from("purchase_protection_claims")
    .select("id, status")
    .eq("order_id", id)
    .eq("buyer_id", user.id)
    .maybeSingle()

  const sellerName =
    sellerProfile?.display_name?.trim() ||
    `Seller ${purchase.seller_id.slice(0, 8)}…`

  const ship = purchase.shipping_address
  const addrBlock = ship?.address ? formatAddress(ship.address) : null
  const paidWithCard = !!purchase.stripe_checkout_session_id
  const fulfill =
    purchase.fulfillment_method === "shipping"
      ? "Shipping"
      : purchase.fulfillment_method === "pickup"
        ? "Local pickup"
        : addrBlock
          ? "Shipping"
          : "Local pickup"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/purchases" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All purchases
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight">
          Order #{purchase.id.slice(0, 8).toUpperCase()}
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date(purchase.created_at).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Paid</Badge>
        <Badge variant="outline" className="gap-1">
          {paidWithCard ? "Card (Stripe)" : "Reswell Bucks"}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {fulfill.includes("Ship") ? (
            <Truck className="h-3.5 w-3.5" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {fulfill}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative h-24 w-24 flex-shrink-0 rounded-lg border bg-muted overflow-hidden">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="96px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              {listingHref ? (
                <Link href={listingHref} className="font-semibold text-foreground hover:text-primary">
                  {title}
                </Link>
              ) : (
                <p className="font-semibold text-foreground">{title}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Sold by {sellerName}</p>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-between text-lg font-semibold">
            <span>Total paid</span>
            <span className="tabular-nums">${Number(purchase.amount).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {addrBlock && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipping address</CardTitle>
            <CardDescription>What you provided at checkout for delivery.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {ship?.name && <p className="font-medium text-foreground">{ship.name}</p>}
            <p className="text-muted-foreground whitespace-pre-line">{addrBlock}</p>
            {ship?.phone && <p className="text-muted-foreground">Phone: {ship.phone}</p>}
            {ship?.email && <p className="text-muted-foreground">Email: {ship.email}</p>}
          </CardContent>
        </Card>
      )}

      {!addrBlock && purchase.fulfillment_method === "pickup" && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p>
              This order was <span className="font-medium text-foreground">local pickup</span>. Use
              Messages to agree on a time and place with the seller.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Purchase Protection Widget */}
      <OrderProtectionWidget
        purchaseId={purchase.id}
        windowCloses={eligibility?.window_closes ?? null}
        isEligible={
          eligibility
            ? eligibility.is_eligible && isProtectionWindowActive(eligibility.window_closes)
            : fulfill !== "Local pickup"
        }
        ineligibleReason={eligibility?.reason ?? null}
        existingClaimId={existingClaim?.id ?? null}
        existingClaimStatus={existingClaim?.status ?? null}
        isLocalPickup={fulfill === "Local pickup"}
      />

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/messages" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Open messages
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/purchases">Back to purchases</Link>
        </Button>
      </div>
    </div>
  )
}
