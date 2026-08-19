import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
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
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
  orderStatusLocksDuringRefund,
} from "@/lib/order-status"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
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
} from "@/components/order-actions"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"
import {
  getLatestPreparedShippingLabelForOrder,
  preparedLabelHasPaperlessQr,
} from "@/lib/db/orderShippingLabels"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { orderHasAccessibleShippingLabelPdf } from "@/lib/services/resolveOrderShippingLabelPdf"
import {
  fetchOptionalOrderTrackingDetailJson,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"
import { listingPortraitThumbClass, listingPortraitThumbSizes } from "@/lib/utils/dashboard-display-styles"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import { sellerReviewRequestAlreadySentForOrder } from "@/lib/services/sellerReviewRequest"
import { AskBuyerReviewButton } from "@/components/features/sales/ask-buyer-review-button"
import { SellerPreparedShippingLabelCard } from "@/components/features/sales/seller-prepared-shipping-label-card"
import { OrderReturnsSection } from "@/components/features/orders/order-returns-section"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import { ReviewBuyerControls } from "@/components/review-buyer-controls"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { resolveMarketplaceOrderBuyerLabel } from "@/lib/order-buyer-display"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Sale details — Reswell",
    description:
      "Manage shipping, tracking, and buyer communication for this surfboard sale on Reswell.",
    path: `/dashboard/sales/${id}`,
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

type PayoutRow = { status: string; hold_reason?: string | null }

type OrderListingRow = {
  id: string
  title: string
  slug?: string | null
  section: string
  board_shipping_cost_mode?: string | null
  shipping_price?: string | number | null
  listing_images: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null
}

type SaleDetail = {
  id: string
  order_num: string | null
  amount: number | string
  shipping_amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string
  promo_discount_usd?: number | string | null
  status: string
  created_at: string
  refunded_at: string | null
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_carrier: string | null
  buyer_id: string | null
  listing_id: string
  payment_method: string | null
  stripe_checkout_session_id: string | null
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
      shipping_amount,
      platform_fee,
      seller_earnings,
      promo_discount_usd,
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
        board_shipping_cost_mode,
        shipping_price,
        listing_images ( url, thumbnail_url, is_primary )
      ),
      order_items (
        sort_order,
        listings (
          id,
          title,
          slug,
          section,
          board_shipping_cost_mode,
          shipping_price,
          listing_images ( url, thumbnail_url, is_primary )
        )
      )
    `,
    )
    .eq("id", id)
    .eq("seller_id", user.id)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .maybeSingle()

  if (error || !row) {
    notFound()
  }

  const sale = row as unknown as SaleDetail
  const trackingDetailRaw = await fetchOptionalOrderTrackingDetailJson(supabase, {
    orderId: id,
    role: "seller",
    sellerId: user.id,
  })

  const { data: payoutFromDb } = await supabase
    .from("payouts")
    .select("status, hold_reason")
    .eq("order_id", id)
    .maybeSingle()

  const payoutRow: PayoutRow | null = payoutFromDb ?? null
  const sortedPack = [...(sale.order_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const linesFromPack: OrderListingRow[] = []
  for (const it of sortedPack) {
    const L = unwrapListing(it.listings as OrderListingRow | OrderListingRow[] | null)
    if (L) linesFromPack.push(L)
  }

  const fallbackListing = unwrapListing(sale.listings)
  const displayListings =
    linesFromPack.length > 0 ? linesFromPack : fallbackListing ? [fallbackListing] : []
  const primaryListing =
    displayListings.find((l) => l.id === sale.listing_id) ?? displayListings[0] ?? fallbackListing
  const isReswellShippingOrder =
    sale.fulfillment_method === "shipping" &&
    primaryListing?.section === "surfboards" &&
    effectiveBoardShippingMode(primaryListing) === "reswell"

  const title =
    displayListings.length > 1
      ? displayListings.map((l) => capitalizeWords(l.title ?? "")).join(" · ")
      : displayListings[0]?.title
        ? capitalizeWords(displayListings[0].title)
        : "Item (listing removed)"

  const ship = sale.shipping_address

  const { data: buyerProfile } = sale.buyer_id
    ? await supabase.from("profiles").select("id, display_name").eq("id", sale.buyer_id).maybeSingle()
    : { data: null }

  const buyerName = resolveMarketplaceOrderBuyerLabel({
    buyerId: sale.buyer_id,
    profileDisplayName: buyerProfile?.display_name,
    shippingAddress: ship,
  })
  const addrBlock = ship?.address ? formatAddress(ship.address) : null
  const fulfill = fulfillmentLabel(sale.fulfillment_method, !!addrBlock)
  const paidWithCard = !!sale.stripe_checkout_session_id
  const isShipping = sale.fulfillment_method === "shipping" || !!addrBlock
  const isPickup = sale.fulfillment_method === "pickup"
  const isRefunded = orderStatusIsRefunded(sale.status)
  const isRefunding = orderStatusIsRefundInProgress(sale.status)
  const fulfillmentLocked = orderStatusLocksDuringRefund(sale.status)
  const amounts = resolveSellerOrderDisplayAmounts(sale)
  const {
    sellerSaleTotal: orderTotal,
    shippingAmount,
    itemPriceAmount,
    platformFee,
    sellerEarningsAmount,
    buyerPaidTotal,
    hadReswellPromo,
  } = amounts
  const carrierTracking = parseOrderTrackingDetail(trackingDetailRaw)
  const serviceSupabase = createServiceRoleClient()
  const preparedShippingLabel = await getLatestPreparedShippingLabelForOrder(serviceSupabase, id)
  const hasPreparedShippingLabel = !!preparedShippingLabel
  const hasPaperlessQr = preparedLabelHasPaperlessQr(preparedShippingLabel)
  const hasAccessibleShippingLabelPdf = await orderHasAccessibleShippingLabelPdf(serviceSupabase, {
    orderId: id,
    trackingNumber: sale.tracking_number,
  })
  const hasShippingTracking = !!sale.tracking_number?.trim()
  const reswellLabelStillPreparing =
    isReswellShippingOrder &&
    sale.delivery_status === "pending" &&
    !hasAccessibleShippingLabelPdf &&
    !hasShippingTracking
  const returnSummaries = await getOrderReturnSummariesByOrderIds(
    supabase,
    [id],
    new Map([[id, displayListings.length || 1]]),
  )
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: sale.status,
    deliveryStatus: sale.delivery_status,
    trackingNumber: sale.tracking_number,
    trackingDetail: carrierTracking,
    hasPreparedShippingLabel: hasPreparedShippingLabel || (isReswellShippingOrder && hasShippingTracking),
    returnSummary: returnSummaries.get(id) ?? null,
    fulfillmentMethod: sale.fulfillment_method,
    hasShippingAddress: !!addrBlock,
  })

  const convRow = sale.buyer_id
    ? await getConversationForBuyerSellerListing(
        supabase,
        sale.buyer_id,
        user.id,
        sale.listing_id,
      )
    : null
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

  const { data: buyerReviewForOrder } = sale.buyer_id
    ? await getMarketplaceReviewByOrderAndReviewer(supabase, id, sale.buyer_id)
    : { data: null }
  const { data: sellerReviewOfBuyer } = await getMarketplaceReviewByOrderAndReviewer(supabase, id, user.id)
  const buyerReviewGate = validateSellerReviewForOrder(
    {
      status: sale.status,
      delivery_status: sale.delivery_status,
    },
    carrierTracking,
  )
  const canAskBuyerForReview =
    buyerReviewGate.ok && !buyerReviewForOrder && Boolean(sale.buyer_id)

  const existingSellerReviewOfBuyer = sellerReviewOfBuyer
    ? {
        id: sellerReviewOfBuyer.id,
        rating: sellerReviewOfBuyer.rating,
        comment: sellerReviewOfBuyer.comment,
        created_at: sellerReviewOfBuyer.created_at,
      }
    : null
  const canSubmitBuyerReview =
    buyerReviewGate.ok && !existingSellerReviewOfBuyer && Boolean(sale.buyer_id)
  const showSellerOwnBuyerReviewUi = !!(existingSellerReviewOfBuyer || canSubmitBuyerReview)

  const reviewRequestAlreadySent =
    canAskBuyerForReview && sale.buyer_id
      ? await sellerReviewRequestAlreadySentForOrder(
          supabase,
          sale.buyer_id,
          user.id,
          id,
          sale.listing_id,
        )
      : false

  return (
    <div className="space-y-6 pb-12">
      <OrderDetailRealtimeRefresh orderId={id} />
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
            <Badge
              variant={statusDisplay.variant}
              className={statusDisplay.className ? `text-xs ${statusDisplay.className}` : "text-xs"}
            >
              {statusDisplay.label}
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
                  Wallet
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
          {(!hasShippingTracking || isPickup) && (
            <DeliveryStatusBadge status={sale.delivery_status} />
          )}
          <PayoutStatusBadge payout={payoutRow} />
        </div>
      </div>

      {/* ── Refund banners (full width, before columns) ── */}
      {isRefunding && (
        <SellerRefundInProgressBanner amount={buyerPaidTotal} paidWithCard={paidWithCard} />
      )}
      {isRefunded && (
        <SellerRefundedBanner
          amount={buyerPaidTotal}
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
              {/* Item row(s) */}
              <div className="divide-y divide-border">
                {displayListings.map((lineListing) => {
                  const rowTitle = lineListing.title ? capitalizeWords(lineListing.title) : "Item (listing removed)"
                  const rowImg = primaryImage(lineListing.listing_images ?? null)
                  const rowHref = listingDetailHref(lineListing)
                  return (
                    <div key={lineListing.id} className="flex gap-4 p-6">
                      <div className={listingPortraitThumbClass}>
                        {rowImg ? (
                          <Image src={rowImg} alt={rowTitle} fill className="object-cover" sizes={listingPortraitThumbSizes} unoptimized={listingImageShouldBypassOptimization(rowImg)} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Link
                              href={rowHref}
                              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                            >
                              {rowTitle}
                              <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                            </Link>
                            {lineListing.section ? (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {capitalizeWords(lineListing.section)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Separator />

              {/* Financial breakdown */}
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sale total</span>
                  <span
                    className={`tabular-nums font-medium ${isRefunded ? "line-through text-muted-foreground" : ""}`}
                  >
                    ${orderTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item price</span>
                  <span
                    className={`tabular-nums ${isRefunded ? "line-through text-muted-foreground" : ""}`}
                  >
                    ${itemPriceAmount.toFixed(2)}
                  </span>
                </div>
                {shippingAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Shipping (paid to carrier, not seller)
                    </span>
                    <span
                      className={`tabular-nums text-muted-foreground ${isRefunded ? "line-through" : ""}`}
                    >
                      ${shippingAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {platformFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee (7% of item)</span>
                    <span
                      className={`tabular-nums text-muted-foreground ${isRefunded ? "line-through" : ""}`}
                    >
                      -${platformFee.toFixed(2)}
                    </span>
                  </div>
                )}
                {hadReswellPromo && !isRefunded && !isRefunding ? (
                  <p className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/80 bg-muted/30 px-2.5 py-2">
                    The buyer used a Reswell promo code. Your earnings are based on the full listing
                    price — the discount is covered by Reswell, not deducted from you.
                  </p>
                ) : null}
                {isRefunding && (
                  <p className="text-xs text-muted-foreground rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-2.5 py-2">
                    Totals stay as recorded until Stripe finishes the refund; your earnings line will mark
                    reversed once the sale is fully refunded.
                  </p>
                )}
                {isRefunded && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-baseline gap-3 rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3 py-2.5">
                      <span className="text-sm font-semibold text-destructive">
                        Refund to buyer (full sale)
                      </span>
                      <span className="text-lg font-bold tabular-nums text-destructive">
                        ${buyerPaidTotal.toFixed(2)}
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
                    ${sellerEarningsAmount.toFixed(2)}
                  </span>
                </div>
                {shippingAmount > 0 && !isRefunded && !isRefunding && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Shipping is paid by the buyer to cover the carrier label and is handled by
                    Reswell — it is not part of your earnings, and the platform fee only applies
                    to the listing price.
                  </p>
                )}
                {isRefunded && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The buyer is refunded the full sale total. The earnings line is your net share
                    that was reversed (after the platform fee).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {sale.fulfillment_method === "shipping" &&
          (hasAccessibleShippingLabelPdf || (isReswellShippingOrder && hasShippingTracking)) ? (
            <SellerPreparedShippingLabelCard
              orderId={sale.id}
              hasPaperlessQr={hasPaperlessQr}
              paperlessInstructions={preparedShippingLabel?.paperless_instructions ?? null}
              paperlessHandoffCode={preparedShippingLabel?.paperless_handoff_code ?? null}
            />
          ) : null}

          {/* ── Seller actions ── */}

          {/* Tracking form for shipping sales */}
          {!fulfillmentLocked && sale.fulfillment_method === "shipping" && (
            <>
              {reswellLabelStillPreparing ? (
                <Card className="border-primary/20 bg-primary/[0.02]">
                  <CardContent className="flex items-start gap-3 p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Truck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Reswell is preparing your shipping label</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        After checkout, Reswell purchases the carrier label and adds tracking here
                        automatically. Refresh this page in a moment if it has not appeared yet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              {!isReswellShippingOrder ? (
                <SellerTrackingForm
                  key={`${sale.tracking_number ?? ""}:${sale.tracking_carrier ?? ""}:${sale.delivery_status}`}
                  orderId={sale.id}
                  deliveryStatus={sale.delivery_status}
                  existingTrackingNumber={sale.tracking_number}
                  existingTrackingCarrier={sale.tracking_carrier}
                />
              ) : null}
            </>
          )}

          {/* Self-purchase ShipEngine label (flat/free shipping on peer listings — not Reswell shipping) */}
          {!fulfillmentLocked &&
            sale.fulfillment_method === "shipping" &&
            displayListings.some((l) => isPeerListingSection(l.section)) &&
            sale.delivery_status === "pending" &&
            !hasPreparedShippingLabel &&
            !isReswellShippingOrder && (
              <Card>
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Buy a shipping label</p>
                      <p className="text-xs text-muted-foreground">
                        Purchase a label through Reswell — tracking and carrier are added to
                        this order automatically.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/shipping?order=${encodeURIComponent(sale.id)}`}>
                      Buy label
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* Pickup verification for local pickup */}
          {!fulfillmentLocked && isPickup && (
            <SellerPickupVerify orderId={sale.id} deliveryStatus={sale.delivery_status} />
          )}

          {sale.tracking_number && (
            <ReswellTrackingSection
              orderId={sale.id}
              trackingNumber={sale.tracking_number}
              trackingCarrier={sale.tracking_carrier}
              initialDetail={carrierTracking}
              marketplaceDeliveryStatus={sale.delivery_status}
              variant="seller"
            />
          )}

          <OrderReturnsSection
            orderId={sale.id}
            audience="seller"
            listingTitlesById={Object.fromEntries(
              displayListings.map((l) => [l.id, l.title ? capitalizeWords(l.title) : "Item"]),
            )}
          />

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
            <CardContent className="pt-0 space-y-3">
              <p className="font-semibold text-foreground">{buyerName}</p>
              <p className="text-xs text-muted-foreground">
                Completed checkout for this sale.
              </p>

              {showSellerOwnBuyerReviewUi ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-xs font-medium text-foreground">Your review of them</p>
                  <ReviewBuyerControls
                    orderId={sale.id}
                    buyerName={buyerName}
                    canReview={canSubmitBuyerReview}
                    existingReview={existingSellerReviewOfBuyer}
                  />
                </div>
              ) : null}

              {canAskBuyerForReview ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {reviewRequestAlreadySent
                      ? "Your review request is in Messages with this buyer. They can tap it anytime to leave stars."
                      : "The buyer can leave a public review now that delivery is complete. We’ll place a friendly card in your message thread with them."}
                  </p>
                  <AskBuyerReviewButton
                    orderId={sale.id}
                    conversationId={conversationId}
                    initialAlreadySent={reviewRequestAlreadySent}
                  />
                </div>
              ) : null}
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

          {/* Sale details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Sale details
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
                    <Badge
                      variant={statusDisplay.variant}
                      className={statusDisplay.className ? `text-xs ${statusDisplay.className}` : "text-xs"}
                    >
                      {statusDisplay.label}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="text-foreground">
                    {paidWithCard ? "Card (Stripe)" : "Wallet"}
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
