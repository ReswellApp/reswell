import { loadPublicOrderTrackingRow } from "@/lib/db/publicOrderTracking"
import { capitalizeWords } from "@/lib/listing-labels"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { withTrackingEventCoordinates } from "@/lib/shipping/tracking-map-points"

export type PublicOrderTrackingPage = {
  orderId: string
  orderNumber: string
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
  deliveryStatus: string
  detail: OrderTrackingDetail | null
}

export async function getPublicOrderTrackingPage(orderId: string): Promise<PublicOrderTrackingPage | null> {
  const id = orderId.trim()
  if (!id) return null
  const row = await loadPublicOrderTrackingRow(id)
  if (!row) return null
  return {
    orderId: row.id,
    orderNumber: formatOrderNumForCustomer(row.order_num, row.id),
    listingTitle: capitalizeWords(row.listing_title) || "Your order",
    trackingNumber: row.tracking_number,
    trackingCarrier: row.tracking_carrier,
    deliveryStatus: row.delivery_status,
    detail: await withTrackingEventCoordinates(parseOrderTrackingDetail(row.tracking_detail)),
  }
}
