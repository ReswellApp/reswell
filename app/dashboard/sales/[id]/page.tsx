import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, Truck, MapPin, CreditCard } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { ORDER_STATUS_LIST, orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { OrderMessageThread, type OrderThreadMessage } from "@/components/order-message-thread"
import {
  SellerTrackingForm,
  SellerPickupVerify,
  DeliveryStatusBadge,
  PayoutStatusBadge,
  TrackingInfo,
} from "@/components/order-actions"

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

type PayoutRow = { status: string; hold_reason?: string | null }

type SaleDetail = {
  id: string
  order_num: string | null
  amount: number | string
  seller_earnings: number | string
  status: string
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_carrier: string | null
  buyer_id: string
  listing_id: string
  stripe_checkout_session_id: string | null
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

function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to buyer"
  if (method === "pickup") return "Local pickup"
  return hasShipAddr ? "Ship to buyer" : "Local pickup"
}

/** Avoid caching a mistaken 404; each sale is user-specific and dynamic. */
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function SaleDetailPage(props: { params: Promise<{ id: string }> }) {
  const raw = (await props.params).id
  const id = decodeURIComponent(typeof raw === "string" ? raw.trim() : "").trim()
  if (!id || !UUID_RE.test(id)) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Keep the same `orders` + `listings` embed shape as `/dashboard/sales` so the detail view
  // loads whenever the list row exists. Payouts are loaded separately — embedding `payouts` here
  // has caused PostgREST to fail the whole request while the list query still succeeds.
  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      seller_earnings,
      status,
      created_at,
      shipping_address,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      buyer_id,
      listing_id,
      stripe_checkout_session_id,
      listings (
        id,
        title,
        slug,
        section,
        listing_images ( url, is_primary )
      )
    `,
    )
    .eq("id", id)
    .eq("seller_id", user.id)
    .in("status", [...ORDER_STATUS_LIST])
    .maybeSingle()

  if (error || !row) {
    notFound()
  }

  const sale = row as unknown as SaleDetail

  const { data: payoutFromDb } = await supabase
    .from("payouts")
    .select("status, hold_reason")
    .eq("order_id", id)
    .maybeSingle()

  const payoutRow: PayoutRow | null = payoutFromDb ?? null
  const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
  const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
  const img = primaryImage(listing?.listing_images ?? null)
  const listingHref = listing ? listingDetailHref(listing) : null

  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", sale.buyer_id)
    .maybeSingle()

  const buyerDisplay = buyerProfile?.display_name?.trim()
  const buyerName =
    buyerDisplay && buyerDisplay.length > 0 ? buyerDisplay : `Buyer ${sale.buyer_id.slice(0, 8)}…`

  const ship = sale.shipping_address
  const addrBlock = ship?.address ? formatAddress(ship.address) : null
  const fulfill = fulfillmentLabel(sale.fulfillment_method, !!addrBlock)
  const paidWithCard = !!sale.stripe_checkout_session_id

  const { data: convRow } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", sale.buyer_id)
    .eq("seller_id", user.id)
    .eq("listing_id", sale.listing_id)
    .maybeSingle()

  const conversationId = convRow?.id ?? null

  let initialMessages: OrderThreadMessage[] = []
  if (conversationId) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, content, sender_id, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(8)

    initialMessages = [...(msgs ?? [])].reverse()

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/sales" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All sales
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight">
          Sale #{formatOrderNumForCustomer(sale.order_num, sale.id)}
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date(sale.created_at).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={orderStatusBadgeVariant(sale.status)}>{orderStatusLabel(sale.status)}</Badge>
        <Badge variant="outline" className="gap-1">
          {paidWithCard ? (
            <>
              <CreditCard className="h-3.5 w-3.5" />
              Card (Stripe)
            </>
          ) : (
            "Reswell Bucks"
          )}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {fulfill.includes("Ship") ? (
            <Truck className="h-3.5 w-3.5" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {fulfill}
        </Badge>
        <DeliveryStatusBadge status={sale.delivery_status} />
        <PayoutStatusBadge payout={payoutRow} />
      </div>

      {/* Seller action: add tracking for shipping orders */}
      {sale.fulfillment_method === "shipping" && (
        <SellerTrackingForm orderId={sale.id} deliveryStatus={sale.delivery_status} />
      )}

      {sale.fulfillment_method === "shipping" &&
        listing?.section === "surfboards" &&
        sale.delivery_status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/shipping?order=${encodeURIComponent(sale.id)}`}>
                Print shipping label
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground self-center">
              Label purchase via ShipEngine.{" "}
              <Link href="/shipping" className="underline font-medium text-foreground">
                Full shipping guide
              </Link>
            </p>
          </div>
        )}

      {/* Seller action: verify pickup code for local pickup */}
      {sale.fulfillment_method === "pickup" && (
        <SellerPickupVerify orderId={sale.id} deliveryStatus={sale.delivery_status} />
      )}

      {/* Show tracking info if already added */}
      {sale.tracking_number && (
        <TrackingInfo
          trackingNumber={sale.tracking_number}
          trackingCarrier={sale.tracking_carrier}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buyer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-foreground">{buyerName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            They completed checkout for this order. Use messages below to coordinate.
          </p>
        </CardContent>
      </Card>

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
            </div>
          </div>
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Order total</span>
              <span className="tabular-nums">${Number(sale.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-foreground">
              <span>Your earnings</span>
              <span className="tabular-nums">${Number(sale.seller_earnings).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {addrBlock && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipping address</CardTitle>
            <CardDescription>Provided by the buyer at checkout for delivery.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {ship?.name && <p className="font-medium text-foreground">{ship.name}</p>}
            <p className="text-muted-foreground whitespace-pre-line">{addrBlock}</p>
            {ship?.phone && <p className="text-muted-foreground">Phone: {ship.phone}</p>}
            {ship?.email && <p className="text-muted-foreground">Email: {ship.email}</p>}
          </CardContent>
        </Card>
      )}

      {!addrBlock && sale.fulfillment_method === "pickup" && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p>
              This order is <span className="font-medium text-foreground">local pickup</span>. Use
              messages to agree on a time and place with the buyer.
            </p>
          </CardContent>
        </Card>
      )}

      <OrderMessageThread
        conversationId={conversationId}
        initialMessages={initialMessages}
        counterpartyName={buyerName}
        currentUserId={user.id}
        variant="seller"
      />
    </div>
  )
}
