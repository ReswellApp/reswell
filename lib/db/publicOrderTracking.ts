import { createServiceRoleClient } from "@/lib/supabase/server"

export type PublicOrderTrackingRow = {
  id: string
  order_num: string | null
  tracking_number: string
  tracking_carrier: string | null
  tracking_detail: unknown
  delivery_status: string
  listing_title: string | null
}

function listingTitleFromEmbed(listings: unknown): string | null {
  if (listings == null) return null
  const row = Array.isArray(listings) ? listings[0] : listings
  if (!row || typeof row !== "object" || !("title" in row)) return null
  const title = (row as { title?: unknown }).title
  return typeof title === "string" && title.trim() ? title.trim() : null
}

/** Anonymous tracker page — service role, tracking fields only. */
export async function loadPublicOrderTrackingRow(orderId: string): Promise<PublicOrderTrackingRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_num, tracking_number, tracking_carrier, tracking_detail, delivery_status, listings ( title )")
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[loadPublicOrderTrackingRow]", error.message)
    return null
  }
  if (!data) return null

  const trackingNumber =
    typeof data.tracking_number === "string" ? data.tracking_number.trim() : ""
  if (!trackingNumber) return null

  return {
    id: data.id as string,
    order_num: typeof data.order_num === "string" ? data.order_num : null,
    tracking_number: trackingNumber,
    tracking_carrier: typeof data.tracking_carrier === "string" ? data.tracking_carrier : null,
    tracking_detail: data.tracking_detail,
    delivery_status: typeof data.delivery_status === "string" ? data.delivery_status : "pending",
    listing_title: listingTitleFromEmbed(data.listings),
  }
}
