import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { capitalizeWords } from "@/lib/listing-labels"
import { ORDER_STATUS_LIST, orderStatusIsRefunded } from "@/lib/order-status"
import { resolveSaleCardStatusDisplay } from "@/lib/sale-card-status"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { existingMarketplaceReviewFromRow, isReviewsMetadataColumnMissing } from "@/lib/marketplace-review-photos"
import { OrdersListRealtimeRefresh } from "@/components/order-realtime-refresh"
import { PurchasesOrderList } from "@/components/features/purchases/purchases-order-list"
import {
  purchaseDetailLine,
  purchaseRefundNote,
  purchaseShowsShipping,
  purchaseStatusTone,
  splitPurchaseAmount,
  type PurchaseListItem,
} from "@/lib/purchases-list-display"
import { REAL_MARKETPLACE_PURCHASES_FILTER } from "@/lib/order-admin-test"

export const metadata = privatePageMetadata({
  title: "Purchases — Reswell",
  description: "Track and manage your orders on Reswell.",
  path: "/dashboard/purchases",
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

type ListingImage = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean | null
}

type MarketplaceOrderRow = {
  id: string
  order_num: string | null
  amount: number | string
  shipping_amount?: number | string | null
  status: string
  delivery_status: string
  tracking_number: string | null
  tracking_detail?: unknown
  created_at: string
  shipping_address: ShippingAddressJson
  fulfillment_method: string | null
  seller_id: string
  listings:
    | {
        id: string
        title: string
        condition?: string | null
        listing_images: ListingImage[] | null
      }
    | {
        id: string
        title: string
        condition?: string | null
        listing_images: ListingImage[] | null
      }[]
    | null
}

function primaryImage(images: ListingImage[] | null | undefined) {
  const src = listingTitleThumbnailSrc(images ?? null)
  return src || null
}

function hasShippingAddress(ship: ShippingAddressJson): boolean {
  const addr = ship?.address
  if (!addr) return false
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].some(
    (part) => typeof part === "string" && part.trim().length > 0,
  )
}

/** Buyer-facing labels aligned with the sales list tile pattern. */
function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to you"
  if (method === "pickup") return "Local pickup"
  return "Local pickup"
}

export default async function PurchasesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      status,
      delivery_status,
      tracking_number,
      tracking_detail,
      created_at,
      shipping_address,
      fulfillment_method,
      seller_id,
      listings (
        id,
        title,
        condition,
        listing_images ( url, thumbnail_url, is_primary )
      )
    `,
    )
    .eq("buyer_id", user.id)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })

  const list = (orders ?? []) as unknown as MarketplaceOrderRow[]

  const sellerIds = [...new Set(list.map((p) => p.seller_id).filter(Boolean))]
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", sellerIds)
      : { data: [] as { id: string; display_name: string | null }[] }

  const sellerNameById = new Map(
    (sellerProfiles ?? []).map((p) => [p.id, p.display_name?.trim() || ""]),
  )

  const orderIds = list.map((o) => o.id)
  const returnSummaries = await getOrderReturnSummariesByOrderIds(supabase, orderIds)
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
      .eq("reviewer_id", user.id)
    if (first.error && isReviewsMetadataColumnMissing(first.error)) {
      const fallback = await supabase
        .from("reviews")
        .select("order_id, id, rating, comment, created_at")
        .in("order_id", orderIds)
        .eq("reviewer_id", user.id)
      reviewRows = (fallback.data ?? []) as OwnReviewRow[]
    } else {
      reviewRows = (first.data ?? []) as OwnReviewRow[]
    }
  }

  const reviewsByOrderId = new Map((reviewRows ?? []).map((r) => [r.order_id, r]))

  const items: PurchaseListItem[] = error
    ? []
    : list.map((row) => {
        const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
        const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
        const imageUrl = primaryImage(listing?.listing_images ?? null)
        const sellerRaw = sellerNameById.get(row.seller_id)?.trim()
        const sellerName =
          sellerRaw && sellerRaw.length > 0 ? sellerRaw : `Seller ${row.seller_id.slice(0, 8)}…`
        const shipped = hasShippingAddress(row.shipping_address)
        const fulfill = fulfillmentLabel(row.fulfillment_method, shipped)
        const amounts = splitPurchaseAmount(Number(row.amount), Number(row.shipping_amount ?? 0))
        const trackingDetail = parseOrderTrackingDetail(row.tracking_detail)
        const statusDisplay = resolveSaleCardStatusDisplay({
          orderStatus: row.status,
          deliveryStatus: row.delivery_status ?? "pending",
          trackingNumber: row.tracking_number,
          trackingDetail,
          returnSummary: returnSummaries.get(row.id) ?? null,
          fulfillmentMethod: row.fulfillment_method,
          hasShippingAddress: shipped,
        })
        const review = reviewsByOrderId.get(row.id)
        const existingSellerReview = review ? existingMarketplaceReviewFromRow(review) : null
        const canReviewSeller = !existingSellerReview && canSubmitSellerReview(row, trackingDetail)

        return {
          id: row.id,
          title,
          imageUrl,
          imageUnoptimized: listingImageShouldBypassOptimization(imageUrl),
          sellerName,
          detailLine: purchaseDetailLine(listing?.condition, fulfill),
          itemAmount: amounts.itemAmount,
          shippingAmount: amounts.shippingAmount,
          showShipping: purchaseShowsShipping(fulfill, amounts.shippingAmount),
          amountStruck: orderStatusIsRefunded(row.status),
          orderNumber: formatOrderNumForCustomer(row.order_num, row.id),
          purchasedAt: row.created_at,
          statusLabel: statusDisplay.label,
          statusTone: purchaseStatusTone(statusDisplay),
          refundNote: purchaseRefundNote(row.status, Number(row.amount)),
          href: `/dashboard/purchases/${row.id}`,
          sellerReview:
            canReviewSeller || existingSellerReview
              ? { canReview: canReviewSeller, existing: existingSellerReview }
              : null,
        }
      })

  return (
    <div>
      <OrdersListRealtimeRefresh role="buyer" />
      <header className="hidden border-b border-border/80 pb-5 lg:block">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          Your Purchases
        </h1>
        <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
          Track and manage your orders.
        </p>
      </header>

      <div className="mt-6 lg:mt-8">
        {error ? (
          <p className="text-sm text-destructive">
            Could not load purchases. If this persists, check that marketplace RLS policies for{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">orders</code> are applied in
            Supabase.
          </p>
        ) : (
          <PurchasesOrderList items={items} />
        )}
      </div>
    </div>
  )
}
