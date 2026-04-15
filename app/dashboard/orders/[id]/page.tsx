import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, Truck, MapPin } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  BuyerConfirmDelivery,
  BuyerPickupCode,
  DeliveryStatusBadge,
  TrackingInfo,
} from "@/components/order-actions"
import { BuyerOrderExperience } from "@/components/features/buyer-order/buyer-order-experience"
import { OrderMessageThread, type OrderThreadMessage } from "@/components/order-message-thread"
import { canSubmitCancelRequest, canSubmitRefundHelpRequest } from "@/lib/services/orderBuyerSupport"

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

type OrderDetail = {
  id: string
  order_num: string | null
  amount: number | string
  status: string
  created_at: string
  refunded_at: string | null
  payment_method: string | null
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_carrier: string | null
  pickup_code: string | null
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

/** Avoid caching stale threads; order detail is user-specific. */
export const dynamic = "force-dynamic"

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

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      status,
      created_at,
      refunded_at,
      payment_method,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      pickup_code,
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

  const order = row as unknown as OrderDetail
  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
  const img = primaryImage(listing?.listing_images ?? null)
  const listingHref = listing ? listingDetailHref(listing) : null

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", order.seller_id)
    .maybeSingle()

  const sellerName =
    sellerProfile?.display_name?.trim() ||
    `Seller ${order.seller_id.slice(0, 8)}…`

  const ship = order.shipping_address
  const addrBlock = ship?.address ? formatAddress(ship.address) : null
  const paidWithCard = !!order.stripe_checkout_session_id
  const fulfill =
    order.fulfillment_method === "shipping"
      ? "Shipping"
      : order.fulfillment_method === "pickup"
        ? "Local pickup"
        : addrBlock
          ? "Shipping"
          : "Local pickup"

  const convRow = await getConversationForBuyerSeller(supabase, user.id, order.seller_id)

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
          <Link href="/dashboard/orders" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight">
          Order #{formatOrderNumForCustomer(order.order_num, order.id)}
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date(order.created_at).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
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
        <DeliveryStatusBadge status={order.delivery_status} />
      </div>

      <BuyerOrderExperience
        orderId={order.id}
        displayOrderNum={formatOrderNumForCustomer(order.order_num, order.id)}
        createdAtIso={order.created_at}
        amount={Number(order.amount)}
        status={order.status}
        fulfillmentMethod={order.fulfillment_method}
        deliveryStatus={order.delivery_status}
        trackingNumber={order.tracking_number}
        trackingCarrier={order.tracking_carrier}
        paidWithCard={paidWithCard}
        paymentMethod={order.payment_method}
        refundedAt={order.refunded_at}
        listingTitle={title}
        sellerName={sellerName}
        messagesHref={`/messages?user=${encodeURIComponent(order.seller_id)}&listing=${encodeURIComponent(order.listing_id)}`}
        canRequestCancel={order.status === "confirmed" && canSubmitCancelRequest(order)}
        canRequestRefundHelp={order.status === "confirmed" && canSubmitRefundHelpRequest(order)}
      />

      {/* Buyer action: confirm delivery for shipped orders (hidden when refunded) */}
      {order.status !== "refunded" && (
        <BuyerConfirmDelivery orderId={order.id} deliveryStatus={order.delivery_status} />
      )}

      {/* Buyer: show pickup code for local pickup (hidden when refunded) */}
      {order.status !== "refunded" && order.fulfillment_method === "pickup" && order.pickup_code && (
        <BuyerPickupCode pickupCode={order.pickup_code} deliveryStatus={order.delivery_status} />
      )}

      {/* Tracking info from seller */}
      {order.status !== "refunded" && order.tracking_number && (
        <TrackingInfo
          trackingNumber={order.tracking_number}
          trackingCarrier={order.tracking_carrier}
        />
      )}

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
            <span className="tabular-nums">${Number(order.amount).toFixed(2)}</span>
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

      {!addrBlock && order.fulfillment_method === "pickup" && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p>
              This order is <span className="font-medium text-foreground">local pickup</span>. Use
              messages below to agree on a time and place with the seller.
            </p>
          </CardContent>
        </Card>
      )}

      <OrderMessageThread
        key={conversationId ?? `new-${order.id}`}
        conversationId={conversationId}
        initialMessages={initialMessages}
        counterpartyName={sellerName}
        currentUserId={user.id}
        variant="buyer"
        startConversation={
          conversationId
            ? null
            : { listingId: order.listing_id, sellerId: order.seller_id }
        }
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/orders">Back to orders</Link>
        </Button>
      </div>
    </div>
  )
}
