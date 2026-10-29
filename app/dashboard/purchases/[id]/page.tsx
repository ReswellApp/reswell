import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { REAL_MARKETPLACE_PURCHASES_FILTER } from "@/lib/order-admin-test"
import { orderStatusIsRefunded, orderStatusLocksDuringRefund } from "@/lib/order-status"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { BuyerConfirmDelivery, BuyerPickupCode } from "@/components/order-actions"
import { ReswellTrackingSection } from "@/components/features/orders/reswell-tracking-section"
import { OrderReturnsSection } from "@/components/features/orders/order-returns-section"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"
import { PurchaseDetailView } from "@/components/features/purchases/purchase-detail-view"
import { OrderMessageThread, type OrderThreadMessage } from "@/components/order-message-thread"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { existingMarketplaceReviewFromRow } from "@/lib/marketplace-review-photos"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  fetchOptionalOrderTrackingDetailJson,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import {
  purchaseDetailLine,
  purchaseRefundNote,
  purchaseShowsShipping,
  purchaseStatusTone,
  splitPurchaseAmount,
} from "@/lib/purchases-list-display"
import {
  buildPurchaseDetailTimeline,
  purchaseDetailStatusDate,
} from "@/lib/purchase-detail-timeline"
import { sellerProfileHref } from "@/lib/seller-slug"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import {
  daysUntilShippingDeadline,
  getShippingDeadlineDate,
  isEligibleForShippingDeadlineAutoCancel,
} from "@/lib/shipping-deadline"
export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Purchase details — Reswell",
    description:
      "Track delivery or pickup, view tracking, and manage resolutions for this purchase.",
    path: `/dashboard/purchases/${id}`,
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
  condition?: string | null
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
  shipping_amount?: number | string | null
  status: string
  created_at: string
  refunded_at: string | null
  carrier_delivered_at?: string | null
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
  order_items?: Array<{
    sort_order: number | null
    item_price?: number | string | null
    listings: OrderListingRow | OrderListingRow[] | null
  }> | null
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

function formatAddressLines(addr: NonNullable<ShippingAddressJson>["address"]) {
  if (!addr) return []
  const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")
  const country = addr.country?.trim() ?? ""
  const showCountry = country.length > 0 && !/^(us|usa|united states)$/i.test(country)
  return [addr.line1, addr.line2, cityLine, showCountry ? country : null].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  )
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
      shipping_amount,
      status,
      created_at,
      refunded_at,
      carrier_delivered_at,
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
        condition,
        listing_images ( url, thumbnail_url, is_primary )
      ),
      order_items (
        sort_order,
        item_price,
        listings (
          id,
          title,
          slug,
          section,
          condition,
          listing_images ( url, thumbnail_url, is_primary )
        )
      )
    `
    )
    .eq("id", id)
    .eq("buyer_id", user.id)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
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
  const packedLines: Array<{ listing: OrderListingRow; itemPrice: number | null }> = []
  for (const it of sortedPack) {
    const listing = unwrapListing(it.listings as OrderListingRow | OrderListingRow[] | null)
    if (!listing) continue
    const price = Number(it.item_price)
    packedLines.push({ listing, itemPrice: Number.isFinite(price) ? price : null })
  }

  const fallbackListing = unwrapListing(order.listings)
  const displayLines =
    packedLines.length > 0
      ? packedLines
      : fallbackListing
        ? [{ listing: fallbackListing, itemPrice: null }]
        : []

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("display_name, seller_slug, avatar_url")
    .eq("id", order.seller_id)
    .maybeSingle()

  const sellerName =
    sellerProfile?.display_name?.trim() ||
    `Seller ${order.seller_id.slice(0, 8)}…`
  const sellerHandle = sellerProfile?.seller_slug?.trim() || null
  const sellerAvatarUrl = profileMediaDisplaySrc(sellerProfile?.avatar_url) || null

  const ship = order.shipping_address
  const addressLines = formatAddressLines(ship?.address)
  if (ship?.phone?.trim()) addressLines.push(ship.phone.trim())
  const hasAddress = addressLines.length > 0
  const isPickup =
    order.fulfillment_method === "pickup" ||
    (order.fulfillment_method !== "shipping" && !hasAddress)
  const amounts = splitPurchaseAmount(Number(order.amount), Number(order.shipping_amount ?? 0))
  const showShipping = purchaseShowsShipping(isPickup ? "Local pickup" : "Ship to you", amounts.shippingAmount)

  const isRefunded = orderStatusIsRefunded(order.status)
  const fulfillmentLocked = orderStatusLocksDuringRefund(order.status)
  const carrierTracking = parseOrderTrackingDetail(trackingDetailRaw)
  const actualDeliveryAt =
    carrierTracking?.actual_delivery_date ?? order.carrier_delivered_at ?? null
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: order.status,
    deliveryStatus: order.delivery_status ?? "pending",
    trackingNumber: order.tracking_number,
    trackingDetail: carrierTracking,
    fulfillmentMethod: order.fulfillment_method,
    hasShippingAddress: hasAddress,
  })
  const showShippingDeadline =
    !fulfillmentLocked &&
    isEligibleForShippingDeadlineAutoCancel({
      status: order.status,
      fulfillment_method: order.fulfillment_method,
      delivery_status: order.delivery_status,
    })
  const shopListing = displayLines[0]?.listing
  const sellerHref = sellerProfileHref({ seller_slug: sellerHandle })
  const shopHref = shopListing ? listingDetailHref(shopListing) : sellerHref

  const { data: buyerOwnReviewRow } = await getMarketplaceReviewByOrderAndReviewer(supabase, id, user.id)
  const { data: sellerRatedBuyerRow } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    id,
    order.seller_id,
  )

  const existingSellerReview = buyerOwnReviewRow
    ? existingMarketplaceReviewFromRow(buyerOwnReviewRow)
    : null

  const reviewFromSeller = sellerRatedBuyerRow
    ? existingMarketplaceReviewFromRow(sellerRatedBuyerRow)
    : null

  const canSubmitSellerReviewForOrder =
    !existingSellerReview && canSubmitSellerReview(order, carrierTracking)

  const convRow = await getConversationForBuyerSellerListing(
    supabase,
    user.id,
    order.seller_id,
    order.listing_id,
  )

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

  const trackUrl = packageTrackHref({
    orderId: order.id,
    trackingNumber: order.tracking_number,
    trackingCarrier: order.tracking_carrier,
  })

  return (
    <div className="space-y-8">
      <OrderDetailRealtimeRefresh orderId={id} />
      <PurchaseDetailView
        orderId={order.id}
        orderNumber={formatOrderNumForCustomer(order.order_num, order.id)}
        items={
          displayLines.length > 0
            ? displayLines.map((line) => {
                const imageUrl = primaryImage(line.listing.listing_images ?? null)
                const single = displayLines.length === 1
                return {
                  id: line.listing.id,
                  title: line.listing.title ? capitalizeWords(line.listing.title) : "Item (listing removed)",
                  sellerName,
                  detailLine: purchaseDetailLine(
                    line.listing.condition,
                    isPickup ? "Local pickup" : "Ship to you",
                  ),
                  imageUrl,
                  imageUnoptimized: listingImageShouldBypassOptimization(imageUrl),
                  href: listingDetailHref(line.listing),
                  price: single ? amounts.itemAmount : line.itemPrice,
                }
              })
            : [
                {
                  id: order.id,
                  title: "Item (listing removed)",
                  sellerName,
                  detailLine: isPickup ? "Local pickup" : "Ship to you",
                  imageUrl: null,
                  imageUnoptimized: false,
                  href: sellerHref,
                  price: amounts.itemAmount,
                },
              ]
        }
        itemAmount={amounts.itemAmount}
        shippingAmount={amounts.shippingAmount}
        showShipping={showShipping}
        totalAmount={Number(order.amount) || 0}
        amountStruck={isRefunded}
        refundNote={purchaseRefundNote(order.status, Number(order.amount) || 0)}
        statusLabel={statusDisplay.label}
        statusTone={purchaseStatusTone(statusDisplay)}
        statusDateIso={purchaseDetailStatusDate({
          deliveryStatus: order.delivery_status,
          orderStatus: order.status,
          createdAt: order.created_at,
          actualDeliveryAt,
          refundedAt: order.refunded_at,
        })}
        shippingDeadlineIso={
          showShippingDeadline ? getShippingDeadlineDate(order.created_at).toISOString() : null
        }
        shippingDaysLeft={showShippingDeadline ? daysUntilShippingDeadline(order.created_at) : null}
        timeline={buildPurchaseDetailTimeline({
          createdAt: order.created_at,
          fulfillmentMethod: isPickup ? "pickup" : "shipping",
          deliveryStatus: order.delivery_status,
          orderStatus: order.status,
          hasTrackingNumber: Boolean(order.tracking_number?.trim()),
          carrierStatusCode: carrierTracking?.status_code,
          events: carrierTracking?.events ?? [],
          actualDeliveryAt,
          refundedAt: order.refunded_at,
        })}
        timelineHeading={isPickup ? "Pickup details" : "Shipping Details"}
        addressName={ship?.name?.trim() || null}
        addressLines={addressLines}
        trackUrl={trackUrl}
        sellerName={sellerName}
        sellerHandle={sellerHandle}
        sellerAvatarUrl={sellerAvatarUrl}
        sellerHref={sellerHref}
        messagesHref={`/messages/new?user=${encodeURIComponent(order.seller_id)}&listing=${encodeURIComponent(order.listing_id)}`}
        shopHref={shopHref}
        shopLabel="Shop here again"
        canReview={canSubmitSellerReviewForOrder}
        hideReviewPrompt={fulfillmentLocked}
        existingReview={existingSellerReview}
        reviewFromSeller={reviewFromSeller}
        helpCenterHref="/help"
        messageReswellHref={helpHubHref({
          intent: "order",
          orderId: order.id,
          role: "buyer",
          direct: true,
        })}
      />

      {!fulfillmentLocked && !order.tracking_number?.trim() ? (
        <div className="mx-auto w-full max-w-xl">
          <BuyerConfirmDelivery orderId={order.id} deliveryStatus={order.delivery_status} />
        </div>
      ) : null}

      {!fulfillmentLocked && order.fulfillment_method === "pickup" && order.pickup_code ? (
        <div className="mx-auto w-full max-w-xl">
          <BuyerPickupCode pickupCode={order.pickup_code} deliveryStatus={order.delivery_status} />
        </div>
      ) : null}

      {!fulfillmentLocked && order.tracking_number ? (
        <ReswellTrackingSection
          orderId={order.id}
          trackingNumber={order.tracking_number}
          trackingCarrier={order.tracking_carrier}
          initialDetail={carrierTracking}
          marketplaceDeliveryStatus={order.delivery_status}
          variant="buyer"
          pollOnly
        />
      ) : null}

      <div className="mx-auto w-full max-w-xl">
        <OrderReturnsSection
          orderId={order.id}
          audience="buyer"
          listingTitlesById={Object.fromEntries(
            displayLines.map((line) => [
              line.listing.id,
              line.listing.title ? capitalizeWords(line.listing.title) : "Item",
            ]),
          )}
        />
      </div>

      <div className="mx-auto w-full max-w-xl">
        <OrderMessageThread
          key={conversationId ?? `new-${order.id}`}
          conversationId={conversationId}
          initialMessages={initialMessages}
          counterpartyName={sellerName}
          currentUserId={user.id}
          variant="buyer"
          startConversation={
            conversationId ? null : { listingId: order.listing_id, sellerId: order.seller_id }
          }
        />
      </div>
    </div>
  )
}
