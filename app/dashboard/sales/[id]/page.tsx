import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getShopAccountContext } from "@/lib/services/accountAccess"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Truck } from "lucide-react"
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
  listOrderShippingLabelsForOrder,
  preparedLabelHasPaperlessQr,
} from "@/lib/db/orderShippingLabels"
import { listOrderShipmentsWithItems } from "@/lib/db/orderShipments"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { orderHasAccessibleShippingLabelPdf } from "@/lib/services/resolveOrderShippingLabelPdf"
import {
  fetchOptionalOrderTrackingDetailJson,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { OrderDetailRealtimeRefresh } from "@/components/order-realtime-refresh"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { existingMarketplaceReviewFromRow } from "@/lib/marketplace-review-photos"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import {
  autoSendSellerReviewRequestForOrder,
  sellerReviewRequestAlreadySentForOrder,
} from "@/lib/services/sellerReviewRequest"
import { AskBuyerReviewButton } from "@/components/features/sales/ask-buyer-review-button"
import { SellerPreparedShippingLabelCard } from "@/components/features/sales/seller-prepared-shipping-label-card"
import { OrderReturnsSection } from "@/components/features/orders/order-returns-section"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import { ReviewBuyerControls } from "@/components/review-buyer-controls"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { resolveMarketplaceOrderBuyerLabel } from "@/lib/order-buyer-display"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import {
  listingUsesSantaBarbaraDropoff,
  SANTA_BARBARA_DROPOFF_PHONE_DISPLAY,
  SANTA_BARBARA_DROPOFF_PHONE_E164,
} from "@/lib/dropoff-santa-barbara"
import { SantaBarbaraDropoffInstructionsCard } from "@/components/features/sales/santa-barbara-dropoff-instructions-card"
import { RESWELL_WAREHOUSE_ADDRESS } from "@/lib/reswell-warehouse-address"
import { CarrierAdjustmentNotice } from "@/components/features/shipping/carrier-adjustment-notice"
import { SaleDetailSummary } from "@/components/features/sales/sale-detail-summary"
import { SellerAdjustmentFeeCard } from "@/components/features/sales/seller-adjustment-fee-card"
import { listSellerChargedAdjustmentFees } from "@/lib/services/shippingAdjustmentDispute"
import { purchaseDetailStatusDate } from "@/lib/purchase-detail-timeline"
import { purchaseStatusTone } from "@/lib/purchases-list-display"
import { saleDetailLine, saleRefundNote } from "@/lib/sales-list-display"

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
  dropoff_location_id?: string | null
  condition?: string | null
  dropoff_locations?: { slug?: string | null } | { slug?: string | null }[] | null
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
  shipping_packaging_mode?: string | null
  buyer_id: string | null
  listing_id: string
  payment_method: string | null
  stripe_checkout_session_id: string | null
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{
    id?: string
    listing_id?: string
    sort_order: number | null
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
  const shop = await getShopAccountContext()
  const sellerId = shop?.accountId ?? user.id
  const showPayouts = shop?.permissions.has("payouts.read") ?? true

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
      shipping_packaging_mode,
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
        dropoff_location_id,
        condition,
        dropoff_locations ( slug ),
        listing_images ( url, thumbnail_url, is_primary )
      ),
      order_items (
        id,
        listing_id,
        sort_order,
        listings (
          id,
          title,
          slug,
          section,
          board_shipping_cost_mode,
          shipping_price,
          dropoff_location_id,
          condition,
          dropoff_locations ( slug ),
          listing_images ( url, thumbnail_url, is_primary )
        )
      )
    `,
    )
    .eq("id", id)
    .eq("seller_id", sellerId)
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
    sellerId,
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
  const isSantaBarbaraDropoffOrder = displayListings.some(listingUsesSantaBarbaraDropoff)
  const isReswellShippingOrder =
    sale.fulfillment_method === "shipping" &&
    isPeerListingSection(primaryListing?.section) &&
    effectiveBoardShippingMode(primaryListing) === "reswell"

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
  const chargedAdjustmentFees = await listSellerChargedAdjustmentFees({
    orderId: id,
    sellerId,
    trackingCarrier: sale.tracking_carrier,
  })
  const preparedShippingLabel = await getLatestPreparedShippingLabelForOrder(serviceSupabase, id)
  const marketplaceLabels = await listOrderShippingLabelsForOrder(serviceSupabase, id)
  const shipments = await listOrderShipmentsWithItems(serviceSupabase, id)
  const hasPreparedShippingLabel = !!preparedShippingLabel || marketplaceLabels.length > 0
  const hasPaperlessQr = preparedLabelHasPaperlessQr(preparedShippingLabel)
  const hasAccessibleShippingLabelPdf = await orderHasAccessibleShippingLabelPdf(serviceSupabase, {
    orderId: id,
    trackingNumber: sale.tracking_number,
  })
  const hasShippingTracking = !!sale.tracking_number?.trim()
  const packageTrackUrl = packageTrackHref({
    orderId: sale.id,
    trackingNumber: sale.tracking_number,
    trackingCarrier: sale.tracking_carrier,
  })
  const shipsSeparately =
    (sale.shipping_packaging_mode === "separate" || shipments.some((s) => s.packaging_kind === "separate_item")) &&
    (shipments.length > 1 || marketplaceLabels.length > 1)
  const listingTitleByOrderItemId = new Map<string, string>()
  for (const item of sortedPack) {
    if (!item.id) continue
    const listing = unwrapListing(item.listings)
    if (listing?.title) {
      listingTitleByOrderItemId.set(item.id, capitalizeWords(listing.title))
    }
  }
  const labelByShipmentId = new Map(
    marketplaceLabels
      .filter((l) => l.shipment_id)
      .map((l) => [l.shipment_id as string, l] as const),
  )
  const reswellLabelStillPreparing =
    !isSantaBarbaraDropoffOrder &&
    isReswellShippingOrder &&
    sale.delivery_status === "pending" &&
    !hasAccessibleShippingLabelPdf &&
    !hasShippingTracking &&
    marketplaceLabels.length === 0
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

  const orderNumber = formatOrderNumForCustomer(sale.order_num, sale.id)

  const { data: buyerReviewForOrder } = sale.buyer_id
    ? await getMarketplaceReviewByOrderAndReviewer(supabase, id, sale.buyer_id)
    : { data: null }
  const { data: sellerReviewOfBuyer } = await getMarketplaceReviewByOrderAndReviewer(supabase, id, sellerId)
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
    ? existingMarketplaceReviewFromRow(sellerReviewOfBuyer)
    : null
  const canSubmitBuyerReview =
    buyerReviewGate.ok && !existingSellerReviewOfBuyer && Boolean(sale.buyer_id)
  const showSellerOwnBuyerReviewUi = !!(existingSellerReviewOfBuyer || canSubmitBuyerReview)

  let reviewRequestAlreadySent =
    canAskBuyerForReview && sale.buyer_id
      ? await sellerReviewRequestAlreadySentForOrder(
          supabase,
          sale.buyer_id,
          sellerId,
          id,
          sale.listing_id,
        )
      : false

  if (canAskBuyerForReview && !reviewRequestAlreadySent) {
    const autoSent = await autoSendSellerReviewRequestForOrder(id)
    if (autoSent.ok && (autoSent.alreadySent || autoSent.conversationId)) {
      reviewRequestAlreadySent = true
    }
  }

  const convRow = sale.buyer_id
    ? await getConversationForBuyerSellerListing(
        supabase,
        sale.buyer_id,
        sellerId,
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
      .neq("sender_id", sellerId)
  }

  const summaryItems = displayListings.map((lineListing) => {
    const rowTitle = lineListing.title ? capitalizeWords(lineListing.title) : "Item (listing removed)"
    const rowImg = primaryImage(lineListing.listing_images ?? null)
    return {
      id: lineListing.id,
      title: rowTitle,
      buyerName,
      detailLine: saleDetailLine(lineListing.condition, fulfill, listingUsesSantaBarbaraDropoff(lineListing)),
      imageUrl: rowImg,
      imageUnoptimized: listingImageShouldBypassOptimization(rowImg),
      href: listingDetailHref(lineListing),
      price: displayListings.length === 1 ? itemPriceAmount : null,
    }
  })
  const addressLines = addrBlock ? addrBlock.split("\n").filter((line) => line.trim().length > 0) : []
  const refundNote = saleRefundNote(sale.status, buyerPaidTotal)
  const earningsRefundNote =
    isRefunded && showPayouts && refundNote
      ? `${refundNote} Your earnings were reversed after the platform fee.`
      : refundNote

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-12">
      <OrderDetailRealtimeRefresh orderId={id} />
      <SaleDetailSummary
        items={summaryItems}
        orderNumber={orderNumber}
        itemAmount={itemPriceAmount}
        shippingAmount={shippingAmount}
        showShipping={shippingAmount > 0}
        platformFee={platformFee}
        showPayouts={showPayouts}
        earningsAmount={sellerEarningsAmount}
        saleTotal={orderTotal}
        amountStruck={isRefunded}
        refundNote={earningsRefundNote}
        promoNote={
          showPayouts && hadReswellPromo && !isRefunded && !isRefunding
            ? "The buyer used a Reswell promo code. Your earnings use the full listing price. Reswell covers the discount."
            : null
        }
        shippingNote={
          showPayouts && shippingAmount > 0 && !isRefunded && !isRefunding
            ? "Shipping is paid by the buyer for the carrier label and is not part of your earnings."
            : null
        }
        paymentLabel={paidWithCard ? "Card" : "Wallet"}
        statusLabel={statusDisplay.label}
        statusTone={purchaseStatusTone(statusDisplay)}
        statusDateIso={purchaseDetailStatusDate({
          deliveryStatus: sale.delivery_status,
          orderStatus: sale.status,
          createdAt: sale.created_at,
          actualDeliveryAt: null,
          refundedAt: sale.refunded_at,
        })}
        addressName={ship?.name ?? null}
        addressLines={addressLines}
        trackUrl={null}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(!hasShippingTracking || isPickup) ? (
          <DeliveryStatusBadge status={sale.delivery_status} />
        ) : null}
        <PayoutStatusBadge payout={payoutRow} />
      </div>

      {isRefunding && (
        <SellerRefundInProgressBanner amount={buyerPaidTotal} paidWithCard={paidWithCard} />
      )}
      {isRefunded && (
        <SellerRefundedBanner
          amount={buyerPaidTotal}
          refundedAt={sale.refunded_at}
        />
      )}

          <SellerAdjustmentFeeCard
            orderId={sale.id}
            buyerShippingUsd={shippingAmount}
            fees={chargedAdjustmentFees}
          />

          {!isSantaBarbaraDropoffOrder &&
          sale.fulfillment_method === "shipping" &&
          !isRefunded &&
          (isReswellShippingOrder || hasPreparedShippingLabel) ? (
            <CarrierAdjustmentNotice variant="prominent" />
          ) : null}

          {isSantaBarbaraDropoffOrder && sale.fulfillment_method === "shipping" ? (
            <SantaBarbaraDropoffInstructionsCard
              addressLine1={RESWELL_WAREHOUSE_ADDRESS.address_line1}
              city={RESWELL_WAREHOUSE_ADDRESS.city_locality}
              state={RESWELL_WAREHOUSE_ADDRESS.state_province}
              postalCode={RESWELL_WAREHOUSE_ADDRESS.postal_code}
              phoneDisplay={SANTA_BARBARA_DROPOFF_PHONE_DISPLAY}
              phoneE164={SANTA_BARBARA_DROPOFF_PHONE_E164}
            />
          ) : null}

          {!isSantaBarbaraDropoffOrder &&
          sale.fulfillment_method === "shipping" &&
          (hasAccessibleShippingLabelPdf ||
            marketplaceLabels.length > 0 ||
            (isReswellShippingOrder && hasShippingTracking)) ? (
            shipsSeparately ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This order ships as separate packages — print and attach each label to the matching board.
                </p>
                {shipments.length > 0
                  ? shipments.map((shipment, index) => {
                      const label = labelByShipmentId.get(shipment.id) ?? marketplaceLabels[index] ?? null
                      if (!label) return null
                      const orderItemId = shipment.order_item_ids[0] ?? label.order_item_id ?? null
                      const boardTitle =
                        (orderItemId ? listingTitleByOrderItemId.get(orderItemId) : null) ||
                        (displayListings[index]?.title
                          ? capitalizeWords(displayListings[index]!.title!)
                          : `Board ${index + 1}`)
                      const tracking = shipment.tracking_number || label.tracking_number
                      const carrier =
                        shipment.tracking_carrier || label.tracking_carrier || "Carrier"
                      return (
                        <SellerPreparedShippingLabelCard
                          key={label.id}
                          orderId={sale.id}
                          labelId={label.id}
                          title={`Package ${index + 1}: ${boardTitle}`}
                          description={tracking ? `${carrier} · ${tracking}` : undefined}
                          hasPaperlessQr={preparedLabelHasPaperlessQr(label)}
                          paperlessInstructions={label.paperless_instructions}
                          paperlessHandoffCode={label.paperless_handoff_code}
                        />
                      )
                    })
                  : marketplaceLabels.map((label, index) => {
                      const boardTitle =
                        (label.order_item_id
                          ? listingTitleByOrderItemId.get(label.order_item_id)
                          : null) ||
                        (displayListings[index]?.title
                          ? capitalizeWords(displayListings[index]!.title!)
                          : `Board ${index + 1}`)
                      return (
                        <SellerPreparedShippingLabelCard
                          key={label.id}
                          orderId={sale.id}
                          labelId={label.id}
                          title={`Package ${index + 1}: ${boardTitle}`}
                          description={
                            label.tracking_number
                              ? `${label.tracking_carrier || "Carrier"} · ${label.tracking_number}`
                              : undefined
                          }
                          hasPaperlessQr={preparedLabelHasPaperlessQr(label)}
                          paperlessInstructions={label.paperless_instructions}
                          paperlessHandoffCode={label.paperless_handoff_code}
                        />
                      )
                    })}
              </div>
            ) : (
              <SellerPreparedShippingLabelCard
                orderId={sale.id}
                hasPaperlessQr={hasPaperlessQr}
                paperlessInstructions={preparedShippingLabel?.paperless_instructions ?? null}
                paperlessHandoffCode={preparedShippingLabel?.paperless_handoff_code ?? null}
              />
            )
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
              {!isSantaBarbaraDropoffOrder && !isReswellShippingOrder ? (
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
            !isReswellShippingOrder &&
            !isSantaBarbaraDropoffOrder && (
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
              trackUrl={packageTrackUrl}
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

      <section className="space-y-3 pt-2">
        <h2 className="text-base font-bold text-foreground">Buyer</h2>
        <p className="font-semibold text-foreground">{buyerName}</p>
        {showSellerOwnBuyerReviewUi ? (
          <ReviewBuyerControls
            orderId={sale.id}
            buyerName={buyerName}
            canReview={canSubmitBuyerReview}
            existingReview={existingSellerReviewOfBuyer}
          />
        ) : null}
        {canAskBuyerForReview ? (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {reviewRequestAlreadySent
                ? "We sent a review request in Messages and emailed the buyer. They can tap it anytime to leave stars."
                : "Delivery is complete. If the automatic request did not send, you can send it here."}
            </p>
            <AskBuyerReviewButton
              orderId={sale.id}
              conversationId={conversationId}
              initialAlreadySent={reviewRequestAlreadySent}
            />
          </div>
        ) : null}
      </section>

      {!addrBlock && isPickup ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Local pickup. Coordinate a time and place with the buyer in messages.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-foreground">Messages</h2>
        <OrderMessageThread
          conversationId={conversationId}
          initialMessages={initialMessages}
          counterpartyName={buyerName}
          currentUserId={sellerId}
          variant="seller"
        />
      </section>
    </div>
  )
}
