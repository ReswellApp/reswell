/**
 * Seller sales with a prepared label that the carrier has not scanned yet.
 * Used by live-chat ship-from address updates.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { saleIsAwaitingCarrierScan } from "@/lib/sale-fulfillment-filters"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { ORDER_STATUS_LIST } from "@/lib/order-status"

export type LiveChatLabelEligibleOrder = {
  orderId: string
  orderNum: string
  title: string
  imageUrl: string | null
}

type ListingImageRow = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

type OrderRow = {
  id: string
  order_num: string | null
  seller_id: string
  status: string
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_detail: unknown
  shipping_address: unknown
  listings:
    | {
        title?: string | null
        listing_images?: ListingImageRow[] | null
      }
    | Array<{
        title?: string | null
        listing_images?: ListingImageRow[] | null
      }>
    | null
}

function listingOf(row: OrderRow) {
  if (!row.listings) return null
  return Array.isArray(row.listings) ? row.listings[0] ?? null : row.listings
}

export async function listLiveChatLabelEligibleOrdersForSeller(
  supabase: SupabaseClient,
  sellerId: string,
  limit = 12,
): Promise<LiveChatLabelEligibleOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      status,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_detail,
      shipping_address,
      listings (
        title,
        listing_images ( url, thumbnail_url, is_primary )
      )
    `,
    )
    .eq("seller_id", sellerId)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST].filter((s) => s !== "refunded" && s !== "refunding"))
    .eq("fulfillment_method", "shipping")
    .order("created_at", { ascending: false })
    .limit(40)

  if (error || !data?.length) {
    if (error) console.warn("[liveChatLabelEligibleOrders]", error.message)
    return []
  }

  const rows = data as unknown as OrderRow[]
  const prepared = await fetchOrderIdsWithPreparedShippingLabels(
    supabase,
    rows.map((row) => row.id),
  )

  const out: LiveChatLabelEligibleOrder[] = []
  for (const row of rows) {
    const hasShippingAddress = Boolean(
      row.shipping_address && typeof row.shipping_address === "object",
    )
    const filterInput = {
      fulfillmentMethod: row.fulfillment_method,
      deliveryStatus: row.delivery_status,
      orderStatus: row.status,
      hasShippingAddress,
      hasPreparedShippingLabel: prepared.has(row.id),
    }
    if (
      !saleIsAwaitingCarrierScan({
        ...filterInput,
        trackingNumber: row.tracking_number,
        trackingDetail: parseOrderTrackingDetail(row.tracking_detail),
      })
    ) {
      continue
    }

    const listing = listingOf(row)
    const title =
      typeof listing?.title === "string" && listing.title.trim()
        ? listing.title.trim()
        : "Your sale"
    const thumb = listingTitleThumbnailSrc(listing?.listing_images ?? null)
    out.push({
      orderId: row.id,
      orderNum: formatOrderNumForCustomer(row.order_num, row.id),
      title,
      imageUrl: thumb || null,
    })
    if (out.length >= limit) break
  }

  return out
}
