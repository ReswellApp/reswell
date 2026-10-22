import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { getShopAccountContext } from "@/lib/services/accountAccess"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  ORDER_STATUS_LIST,
  orderStatusIsRefunded,
} from "@/lib/order-status"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  fetchOrderIdsWithPreparedShippingLabels,
  fetchOrderIdsWithPrintableShippingLabelPdfs,
} from "@/lib/db/orderShippingLabels"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { OrdersListRealtimeRefresh } from "@/components/order-realtime-refresh"
import { SalesOrderList } from "@/components/features/sales/sales-order-list"
import {
  PrintShippingLabelsModule,
  type PrintableShippingLabelSale,
} from "@/components/features/sales/print-shipping-labels-module"
import {
  AwaitingDropoffTiles,
  type AwaitingDropoffSale,
} from "@/components/features/sales/awaiting-dropoff-tiles"
import {
  compareSalesForSellerList,
  parseSalesListFilter,
  saleHasPrintableOpenLabel,
  saleIsAwaitingCarrierScan,
  saleIsPendingPickup,
  saleIsPendingShipment,
  saleMatchesListFilter,
  saleNeedsFulfillment,
  type SaleFulfillmentFilterInput,
} from "@/lib/sale-fulfillment-filters"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { resolveMarketplaceOrderBuyerLabel } from "@/lib/order-buyer-display"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { listingsUseSantaBarbaraDropoff } from "@/lib/dropoff-santa-barbara"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import {
  existingMarketplaceReviewFromRow,
  isReviewsMetadataColumnMissing,
} from "@/lib/marketplace-review-photos"
import { purchaseStatusTone } from "@/lib/purchases-list-display"
import {
  saleDetailLine,
  saleRefundNote,
  type SaleListItem,
} from "@/lib/sales-list-display"

export const metadata = privatePageMetadata({
  title: "Sales — Reswell",
  description: "Track and fulfill your orders.",
  path: "/dashboard/sales",
})

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

type SaleRow = {
  id: string
  order_num: string | null
  amount: number | string
  shipping_amount?: number | string | null
  platform_fee?: number | string | null
  seller_earnings: number | string
  promo_discount_usd?: number | string | null
  status: string
  delivery_status: string
  tracking_number: string | null
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  buyer_id: string | null
  listing_id: string
  stripe_checkout_session_id: string | null
  listings:
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        dropoff_location_id?: string | null
        dropoff_locations?: { slug?: string | null } | { slug?: string | null }[] | null
        condition?: string | null
        listing_images: Array<{
          url: string
          thumbnail_url?: string | null
          is_primary: boolean | null
        }> | null
      }
    | {
        id: string
        title: string
        slug?: string | null
        section: string
        condition?: string | null
        dropoff_location_id?: string | null
        dropoff_locations?: { slug?: string | null } | { slug?: string | null }[] | null
        listing_images: Array<{
          url: string
          thumbnail_url?: string | null
          is_primary: boolean | null
        }> | null
      }[]
    | null
  order_items?: Array<{
    listings:
      | {
          dropoff_location_id?: string | null
          dropoff_locations?: { slug?: string | null } | { slug?: string | null }[] | null
        }
      | Array<{
          dropoff_location_id?: string | null
          dropoff_locations?: { slug?: string | null } | { slug?: string | null }[] | null
        }>
      | null
  }> | null
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

function saleUsesSantaBarbaraDropoff(sale: SaleRow): boolean {
  const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
  return listingsUseSantaBarbaraDropoff([
    listing,
    ...(sale.order_items ?? []).map((item) =>
      Array.isArray(item.listings) ? item.listings[0] : item.listings,
    ),
  ])
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  const shop = await getShopAccountContext()
  const sellerId = shop?.accountId ?? user.id
  const showPayouts = shop?.permissions.has("payouts.read") ?? true

  const params = await searchParams
  const activeFilter = parseSalesListFilter(params.filter)

  const { data: sales, error } = await supabase
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
      delivery_status,
      tracking_number,
      created_at,
      shipping_address,
      fulfillment_method,
      buyer_id,
      listing_id,
      stripe_checkout_session_id,
      listings (
        id,
        title,
        slug,
        section,
        dropoff_location_id,
        condition,
        dropoff_locations ( slug ),
        listing_images ( url, thumbnail_url, is_primary )
      ),
      order_items (
        listings ( dropoff_location_id, dropoff_locations ( slug ) )
      )
    `
    )
    .eq("seller_id", sellerId)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[dashboard/sales] orders query failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      timestamp: new Date().toISOString(),
    })
  }

  const list = (sales ?? []) as unknown as SaleRow[]
  const santaBarbaraDropoffOrderIds = new Set(
    list.filter(saleUsesSantaBarbaraDropoff).map((sale) => sale.id),
  )

  const orderIds = list.map((s) => s.id)
  const [preparedLabelOrderIds, printablePdfOrderIds] = await Promise.all([
    fetchOrderIdsWithPreparedShippingLabels(supabase, orderIds),
    fetchOrderIdsWithPrintableShippingLabelPdfs(supabase, orderIds),
  ])
  const returnSummaries = await getOrderReturnSummariesByOrderIds(
    supabase,
    list.map((s) => s.id),
  )

  const trackingOrderIds = list.filter((s) => s.tracking_number?.trim()).map((s) => s.id)
  const trackingDetailByOrderId = new Map<string, ReturnType<typeof parseOrderTrackingDetail>>()
  if (trackingOrderIds.length > 0) {
    const { data: trackingRows } = await supabase
      .from("orders")
      .select("id, tracking_detail")
      .in("id", trackingOrderIds)
      .eq("seller_id", sellerId)

    for (const row of trackingRows ?? []) {
      const detail = parseOrderTrackingDetail(
        (row as { tracking_detail?: unknown }).tracking_detail,
      )
      if (detail) {
        trackingDetailByOrderId.set((row as { id: string }).id, detail)
      }
    }
  }

  const buyerIds = [...new Set(list.map((s) => s.buyer_id).filter(Boolean))]
  const { data: buyerProfiles } =
    buyerIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", buyerIds)
      : { data: [] as { id: string; display_name: string | null }[] }

  const buyerNameById = new Map(
    (buyerProfiles ?? []).map((p) => [p.id, p.display_name?.trim() || ""]),
  )

  function saleFilterInput(sale: SaleRow): SaleFulfillmentFilterInput {
    const ship = sale.shipping_address
    return {
      fulfillmentMethod: sale.fulfillment_method,
      deliveryStatus: sale.delivery_status ?? "pending",
      orderStatus: sale.status,
      hasShippingAddress: Boolean(ship?.address && formatAddress(ship.address)),
      hasPreparedShippingLabel:
        !santaBarbaraDropoffOrderIds.has(sale.id) && preparedLabelOrderIds.has(sale.id),
    }
  }

  const pendingShipmentCount = list.filter((sale) => saleIsPendingShipment(saleFilterInput(sale))).length
  const pendingPickupCount = list.filter((sale) => saleIsPendingPickup(saleFilterInput(sale))).length
  const visibleList = list
    .filter((sale) => saleMatchesListFilter(saleFilterInput(sale), activeFilter))
    .sort((a, b) =>
      compareSalesForSellerList(
        { createdAt: a.created_at, filterInput: saleFilterInput(a) },
        { createdAt: b.created_at, filterInput: saleFilterInput(b) },
      ),
    )

  const printableLabelSales: PrintableShippingLabelSale[] = list
    .filter(
      (sale) =>
        saleIsPendingShipment(saleFilterInput(sale)) &&
        !santaBarbaraDropoffOrderIds.has(sale.id),
    )
    .map((sale) => {
      const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
      const buyerDisplay = sale.buyer_id ? buyerNameById.get(sale.buyer_id)?.trim() : ""
      return {
        orderId: sale.id,
        orderNum: formatOrderNumForCustomer(sale.order_num, sale.id),
        title: listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)",
        imageUrl: primaryImage(listing?.listing_images ?? null),
        buyerName: resolveMarketplaceOrderBuyerLabel({
          buyerId: sale.buyer_id,
          profileDisplayName: buyerDisplay,
          shippingAddress: sale.shipping_address,
        }),
        hasPrintableLabel:
          saleHasPrintableOpenLabel(saleFilterInput(sale)) && printablePdfOrderIds.has(sale.id),
      }
    })

  const awaitingDropoffSales: AwaitingDropoffSale[] = list
    .filter(
      (sale) =>
        !santaBarbaraDropoffOrderIds.has(sale.id) &&
        saleIsAwaitingCarrierScan({
          ...saleFilterInput(sale),
          trackingNumber: sale.tracking_number,
          trackingDetail: trackingDetailByOrderId.get(sale.id) ?? null,
        }),
    )
    .map((sale) => {
      const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
      return {
        orderId: sale.id,
        orderNum: formatOrderNumForCustomer(sale.order_num, sale.id),
        title: listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)",
        imageUrl: primaryImage(listing?.listing_images ?? null),
      }
    })

  type OwnReviewRow = {
    order_id: string
    id: string
    rating: number
    comment: string | null
    created_at: string
    metadata?: unknown
  }
  let reviewRows: OwnReviewRow[] = []
  if (orderIds.length > 0) {
    const first = await supabase
      .from("reviews")
      .select("order_id, id, rating, comment, created_at, metadata")
      .in("order_id", orderIds)
      .eq("reviewer_id", sellerId)
    if (first.error && isReviewsMetadataColumnMissing(first.error)) {
      const fallback = await supabase
        .from("reviews")
        .select("order_id, id, rating, comment, created_at")
        .in("order_id", orderIds)
        .eq("reviewer_id", sellerId)
      reviewRows = (fallback.data ?? []) as OwnReviewRow[]
    } else {
      reviewRows = (first.data ?? []) as OwnReviewRow[]
    }
  }
  const reviewsByOrderId = new Map(reviewRows.map((review) => [review.order_id, review]))

  const saleItems: SaleListItem[] = error
    ? []
    : visibleList.map((sale) => {
        const listing = Array.isArray(sale.listings) ? sale.listings[0] : sale.listings
        const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
        const imageUrl = primaryImage(listing?.listing_images ?? null)
        const ship = sale.shipping_address
        const addrBlock = ship?.address ? formatAddress(ship.address) : null
        const buyerDisplay = sale.buyer_id ? buyerNameById.get(sale.buyer_id)?.trim() : ""
        const buyerName = resolveMarketplaceOrderBuyerLabel({
          buyerId: sale.buyer_id,
          profileDisplayName: buyerDisplay,
          shippingAddress: ship,
        })
        const fulfill = fulfillmentLabel(sale.fulfillment_method, !!addrBlock)
        const filterInput = saleFilterInput(sale)
        const statusDisplay = resolveSaleCardStatusDisplay({
          orderStatus: sale.status,
          deliveryStatus: sale.delivery_status ?? "pending",
          trackingNumber: sale.tracking_number,
          trackingDetail: trackingDetailByOrderId.get(sale.id) ?? null,
          hasPreparedShippingLabel: preparedLabelOrderIds.has(sale.id),
          returnSummary: returnSummaries.get(sale.id) ?? null,
          fulfillmentMethod: sale.fulfillment_method,
          hasShippingAddress: !!addrBlock,
        })
        const amounts = resolveSellerOrderDisplayAmounts(sale)
        const review = reviewsByOrderId.get(sale.id)
        const existingBuyerReview = review ? existingMarketplaceReviewFromRow(review) : null
        const canReviewBuyer =
          !existingBuyerReview &&
          canSubmitSellerReview(
            { status: sale.status, delivery_status: sale.delivery_status ?? "pending" },
            trackingDetailByOrderId.get(sale.id) ?? null,
          )

        return {
          id: sale.id,
          title,
          imageUrl,
          imageUnoptimized: listingImageShouldBypassOptimization(imageUrl),
          buyerName,
          detailLine: saleDetailLine(
            listing?.condition,
            fulfill,
            santaBarbaraDropoffOrderIds.has(sale.id),
          ),
          primaryAmount: showPayouts ? amounts.sellerEarningsAmount : amounts.sellerSaleTotal,
          primarySuffix: showPayouts ? "earnings" : null,
          shippingAmount: amounts.shippingAmount,
          showShipping: amounts.shippingAmount > 0,
          amountStruck: orderStatusIsRefunded(sale.status),
          orderNumber: formatOrderNumForCustomer(sale.order_num, sale.id),
          soldAt: sale.created_at,
          statusLabel: statusDisplay.label,
          statusTone: purchaseStatusTone(statusDisplay),
          refundNote: saleRefundNote(sale.status, amounts.buyerPaidTotal),
          href: `/dashboard/sales/${sale.id}`,
          needsFulfillment: saleNeedsFulfillment(filterInput),
          buyerReview:
            canReviewBuyer || existingBuyerReview
              ? { canReview: canReviewBuyer, existing: existingBuyerReview }
              : null,
        }
      })

  const filterEmptyMessage =
    activeFilter === "pending-shipment"
      ? "No open orders are waiting to ship."
      : activeFilter === "pending-pickup"
        ? "No open orders are waiting for pickup."
        : "No sales match this filter."

  return (
    <div>
      <OrdersListRealtimeRefresh role="seller" />
      <header className="hidden border-b border-border/80 pb-5 lg:block">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          Your Sales
        </h1>
        <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
          Track and fulfill your orders.
        </p>
      </header>

      {!error && printableLabelSales.length > 0 ? (
        <PrintShippingLabelsModule sales={printableLabelSales} />
      ) : null}

      {!error && awaitingDropoffSales.length > 0 ? (
        <AwaitingDropoffTiles sales={awaitingDropoffSales} />
      ) : null}

      {error ? (
        <div className="mt-6 space-y-1 text-sm text-destructive lg:mt-8">
          <p>Could not load sales. Please try again, or contact support if this persists.</p>
          <p className="text-xs text-muted-foreground">
            Error {error.code ? `${error.code}: ` : ""}
            {error.message}
            {error.hint ? ` — ${error.hint}` : ""}
          </p>
        </div>
      ) : (
        <div className="mt-6 lg:mt-8">
          <SalesOrderList
            items={saleItems}
            hasAnySales={list.length > 0}
            filterEmptyMessage={filterEmptyMessage}
            activeFilter={activeFilter}
            pendingShipmentCount={pendingShipmentCount}
            pendingPickupCount={pendingPickupCount}
            showFulfillmentGroups={activeFilter === "all"}
          />
        </div>
      )}
    </div>
  )
}
