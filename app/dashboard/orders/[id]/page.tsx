import type { Metadata } from "next"
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
import {
  orderStatusBadgeVariant,
  orderStatusIsRefunded,
  orderStatusLocksDuringRefund,
  orderStatusLabel,
} from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { LocalDateTime } from "@/components/ui/local-datetime"
import {
  BuyerConfirmDelivery,
  BuyerPickupCode,
  DeliveryStatusBadge,
  TrackingInfo,
} from "@/components/order-actions"
import { BuyerOrderExperience } from "@/components/features/buyer-order/buyer-order-experience"
import { OrderMessageThread, type OrderThreadMessage } from "@/components/order-message-thread"
import { canSubmitCancelRequest, canSubmitRefundHelpRequest } from "@/lib/services/orderBuyerSupport"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import { getSellerReviewByOrderId } from "@/lib/db/order-reviews"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  fetchOptionalOrderTrackingDetailJson,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { CarrierTrackingPanel } from "@/components/carrier-tracking-panel"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Order details — Reswell",
    description:
      "Track delivery or pickup, view tracking, and manage resolutions for this surfboard purchase.",
    path: `/dashboard/orders/${id}`,
  })
}

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

type OrderListingRow = {
  id: string
  title: string
  slug?: string | null
  section: string
  listing_images: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null
}

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
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}

function unwrapListing<R>(raw: R | R[] | null | undefined): R | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function primaryImage(
  images: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null | undefined,
) {
  const s = listingTitleThumbnailSrc(images ?? null)
  return s || null
}

/** Avoid caching stale threads; order detail is user-specific. */
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
        listing_images ( url, thumbnail_url, is_primary )
      ),
      order_items (
        sort_order,
        listings (
          id,
          title,
          slug,
          section,
          listing_images ( url, thumbnail_url, is_primary )
        )
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
  const trackingDetailRaw = await fetchOptionalOrderTrackingDetailJson(supabase, {
    orderId: id,
    role: "buyer",
    buyerId: user.id,
  })
  const sortedPack = [...(order.order_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const linesFromPack: OrderListingRow[] = []
  for (const it of sortedPack) {
    const L = unwrapListing(it.listings as OrderListingRow | OrderListingRow[] | null)
    if (L) linesFromPack.push(L)
  }

  const fallbackListing = unwrapListing(order.listings)
  const displayListings =
    linesFromPack.length > 0 ? linesFromPack : fallbackListing ? [fallbackListing] : []

  const title =
    displayListings.length > 1
      ? displayListings.map((l) => capitalizeWords(l.title ?? "")).join(" · ")
      : displayListings[0]?.title
        ? capitalizeWords(displayListings[0].title)
        : "Item (listing removed)"

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

  const isRefunded = orderStatusIsRefunded(order.status)
  const fulfillmentLocked = orderStatusLocksDuringRefund(order.status)
  const carrierTracking = parseOrderTrackingDetail(trackingDetailRaw)

  const { data: orderReviewRow } = await getSellerReviewByOrderId(supabase, id)

  const existingSellerReview = orderReviewRow
    ? {
        id: orderReviewRow.id,
        rating: orderReviewRow.rating,
        comment: orderReviewRow.comment,
        created_at: orderReviewRow.created_at,
      }
    : null

  const canSubmitSellerReviewForOrder =
    !existingSellerReview && canSubmitSellerReview(order)

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
      <OrderDetailRealtimeRefresh orderId={id} />
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
          <LocalDateTime iso={order.created_at} dateStyle="long" timeStyle="short" />
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
        <Badge variant="outline" className="gap-1">
          {paidWithCard ? "Card (Stripe)" : "Wallet"}
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
        sellerReview={{
          canSubmit: canSubmitSellerReviewForOrder,
          existing: existingSellerReview,
        }}
      />

      {/* Buyer action: confirm delivery for shipped orders (hidden when refunded) */}
      {!fulfillmentLocked && (
        <BuyerConfirmDelivery orderId={order.id} deliveryStatus={order.delivery_status} />
      )}

      {/* Buyer: show pickup code for local pickup (hidden when refunded) */}
      {!fulfillmentLocked && order.fulfillment_method === "pickup" && order.pickup_code && (
        <BuyerPickupCode pickupCode={order.pickup_code} deliveryStatus={order.delivery_status} />
      )}

      {/* Tracking info from seller */}
      {!fulfillmentLocked && order.tracking_number && (
        <TrackingInfo
          trackingNumber={order.tracking_number}
          trackingCarrier={order.tracking_carrier}
        />
      )}

      {!fulfillmentLocked && carrierTracking && (
        <CarrierTrackingPanel detail={carrierTracking} marketplaceDeliveryStatus={order.delivery_status} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{displayListings.length > 1 ? "Items" : "Item"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-6">
            {displayListings.map((lineListing) => {
              const rowTitle = lineListing.title ? capitalizeWords(lineListing.title) : "Item (listing removed)"
              const rowImg = primaryImage(lineListing.listing_images ?? null)
              const rowHref = listingDetailHref(lineListing)
              return (
                <div key={lineListing.id} className="flex gap-4">
                  <div className="relative h-24 w-24 flex-shrink-0 rounded-lg border bg-muted overflow-hidden">
                    {rowImg ? (
                      <Image src={rowImg} alt="" fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={rowHref} className="font-semibold text-foreground hover:text-primary">
                      {rowTitle}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">Sold by {sellerName}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total paid</span>
              <span
                className={`tabular-nums ${isRefunded ? "line-through text-muted-foreground font-normal" : ""}`}
              >
                ${Number(order.amount).toFixed(2)}
              </span>
            </div>
            {order.status === "refunding" && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
                Refund in progress — your payment is being returned
                {paidWithCard ? " through Stripe" : ""}. This order will show as fully refunded when it
                finishes (card statements can take several business days).
              </div>
            )}
            {isRefunded && (
              <div className="flex justify-between items-baseline gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5 text-base font-semibold">
                <span className="text-emerald-900 dark:text-emerald-100">Refunded to you (full amount)</span>
                <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                  ${Number(order.amount).toFixed(2)}
                </span>
              </div>
            )}
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
