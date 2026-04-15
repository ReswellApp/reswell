import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  CreditCard,
  DollarSign,
  User,
  Clock,
  Hash,
  ExternalLink,
} from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import {
  ORDER_STATUS_LIST,
  orderStatusBadgeVariant,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
  orderStatusLocksDuringRefund,
  orderStatusLabel,
} from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"
import { OrderMessageThread, type OrderThreadMessage } from "@/components/order-message-thread"
import {
  SellerTrackingForm,
  SellerPickupVerify,
  SellerRequestSupportButton,
  SellerRefundedBanner,
  SellerRefundInProgressBanner,
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
  refunded_at: string | null
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_carrier: string | null
  buyer_id: string
  listing_id: string
  payment_method: string | null
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
      refunded_at,
      shipping_address,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      buyer_id,
      listing_id,
      payment_method,
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
  const isShipping = sale.fulfillment_method === "shipping" || !!addrBlock
  const isPickup = sale.fulfillment_method === "pickup"
  const isRefunded = orderStatusIsRefunded(sale.status)
  const isRefunding = orderStatusIsRefundInProgress(sale.status)
  const fulfillmentLocked = orderStatusLocksDuringRefund(sale.status)
  const platformFee = Number(sale.amount) - Number(sale.seller_earnings)

  const convRow = await getConversationForBuyerSeller(supabase, sale.buyer_id, user.id)
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

  const orderNumber = formatOrderNumForCustomer(sale.order_num, sale.id)

  return (
    <div className="space-y-6 pb-12">
      {/* ── Back link ── */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/dashboard/sales" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          All sales
        </Link>
      </Button>

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight">
              #{orderNumber}
            </h1>
            <Badge variant={orderStatusBadgeVariant(sale.status)} className="text-xs">
              {orderStatusLabel(sale.status)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <LocalDateTime iso={sale.created_at} dateStyle="medium" timeStyle="short" />
            </span>
            <span className="flex items-center gap-1.5">
              {paidWithCard ? (
                <>
                  <CreditCard className="h-3.5 w-3.5" />
                  Card (Stripe)
                </>
              ) : (
                <>
                  <DollarSign className="h-3.5 w-3.5" />
                  Reswell Bucks
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              {isShipping ? (
                <Truck className="h-3.5 w-3.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {fulfill}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DeliveryStatusBadge status={sale.delivery_status} />
          <PayoutStatusBadge payout={payoutRow} />
        </div>
      </div>

      {/* ── Refund banners (full width, before columns) ── */}
      {isRefunding && (
        <SellerRefundInProgressBanner amount={Number(sale.amount)} paidWithCard={paidWithCard} />
      )}
      {isRefunded && (
        <SellerRefundedBanner
          amount={Number(sale.amount)}
          refundedAt={sale.refunded_at}
        />
      )}

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order summary card */}
          <Card>
            <CardContent className="p-0">
              {/* Item row */}
              <div className="flex gap-4 p-6">
                <div className="relative h-20 w-20 flex-shrink-0 rounded-lg border bg-muted overflow-hidden">
                  {img ? (
                    <Image src={img} alt={title} fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {listingHref ? (
                        <Link
                          href={listingHref}
                          className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          {title}
                          <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                        </Link>
                      ) : (
                        <p className="font-semibold text-foreground">{title}</p>
                      )}
                      {listing?.section && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {capitalizeWords(listing.section)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial breakdown */}
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order total</span>
                  <span
                    className={`tabular-nums font-medium ${isRefunded ? "line-through text-muted-foreground" : ""}`}
                  >
                    ${Number(sale.amount).toFixed(2)}
                  </span>
                </div>
                {platformFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span
                      className={`tabular-nums text-muted-foreground ${isRefunded ? "line-through" : ""}`}
                    >
                      -${platformFee.toFixed(2)}
                    </span>
                  </div>
                )}
                {isRefunding && (
                  <p className="text-xs text-muted-foreground rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-2.5 py-2">
                    Totals stay as recorded until Stripe finishes the refund; your earnings line will mark
                    reversed once the order is fully refunded.
                  </p>
                )}
                {isRefunded && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-baseline gap-3 rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3 py-2.5">
                      <span className="text-sm font-semibold text-destructive">
                        Refund to buyer (full order)
                      </span>
                      <span className="text-lg font-bold tabular-nums text-destructive">
                        ${Number(sale.amount).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">
                    {isRefunded ? "Your earnings (reversed)" : isRefunding ? "Your earnings (pending reversal)" : "Your earnings"}
                  </span>
                  <span
                    className={`text-xl font-bold tabular-nums ${isRefunded ? "line-through text-muted-foreground" : isRefunding ? "text-muted-foreground" : ""}`}
                  >
                    ${Number(sale.seller_earnings).toFixed(2)}
                  </span>
                </div>
                {isRefunded && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The buyer is refunded the full order total. The earnings line is your net share
                    that was reversed (after the platform fee).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Seller actions ── */}

          {/* Tracking form for shipping orders */}
          {!fulfillmentLocked && sale.fulfillment_method === "shipping" && (
            <SellerTrackingForm orderId={sale.id} deliveryStatus={sale.delivery_status} />
          )}

          {/* Shipping label for surfboard orders */}
          {!fulfillmentLocked &&
            sale.fulfillment_method === "shipping" &&
            listing?.section === "surfboards" &&
            sale.delivery_status === "pending" && (
              <Card>
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Shipping label</p>
                      <p className="text-xs text-muted-foreground">
                        Purchase via ShipEngine
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/shipping?order=${encodeURIComponent(sale.id)}`}>
                      Print label
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* Pickup verification for local pickup */}
          {!fulfillmentLocked && isPickup && (
            <SellerPickupVerify orderId={sale.id} deliveryStatus={sale.delivery_status} />
          )}

          {/* Tracking info when already added */}
          {sale.tracking_number && (
            <TrackingInfo
              trackingNumber={sale.tracking_number}
              trackingCarrier={sale.tracking_carrier}
            />
          )}

          {/* Support request (refund / cancel / return — admin handles it) */}
          {sale.status === "confirmed" && (
            <SellerRequestSupportButton
              orderId={sale.id}
              orderStatus={sale.status}
            />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          {/* Buyer card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Buyer
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="font-semibold text-foreground">{buyerName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed checkout for this order.
              </p>
            </CardContent>
          </Card>

          {/* Fulfillment card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {isShipping ? (
                  <Truck className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {isShipping ? "Shipping" : "Fulfillment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {addrBlock ? (
                <div className="space-y-1 text-sm">
                  {ship?.name && (
                    <p className="font-medium text-foreground">{ship.name}</p>
                  )}
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {addrBlock}
                  </p>
                  {ship?.phone && (
                    <p className="text-muted-foreground">
                      {ship.phone}
                    </p>
                  )}
                </div>
              ) : isPickup ? (
                <p className="text-sm text-muted-foreground">
                  Local pickup. Coordinate a time and place with the buyer via messages.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No shipping address provided.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Order details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Order details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd className="font-mono text-xs text-foreground">
                    #{orderNumber}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={orderStatusBadgeVariant(sale.status)} className="text-xs">
                      {orderStatusLabel(sale.status)}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="text-foreground">
                    {paidWithCard ? "Card (Stripe)" : "Reswell Bucks"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fulfillment</dt>
                  <dd className="text-foreground">{fulfill}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-foreground">
                    <LocalDateOnly iso={sale.created_at} dateStyle="medium" />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Messages */}
          <OrderMessageThread
            conversationId={conversationId}
            initialMessages={initialMessages}
            counterpartyName={buyerName}
            currentUserId={user.id}
            variant="seller"
          />
        </div>
      </div>
    </div>
  )
}
