/**
 * Recent purchases and sales for live-chat order tiles.
 * Image + order number only — no other-party PII.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type LiveChatVisitorOrderTile = {
  orderId: string
  orderNum: string
  title: string
  imageUrl: string | null
  role: "buyer" | "seller"
}

type ListingImageRow = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

type OrderRow = {
  id: string
  order_num: string | null
  buyer_id: string | null
  seller_id: string | null
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

export async function listLiveChatVisitorOrderTilesForMember(
  supabase: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<LiveChatVisitorOrderTile[]> {
  const take = Math.max(1, Math.min(limit, 12))

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listings (
        title,
        listing_images ( url, thumbnail_url, is_primary )
      )
    `,
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .order("created_at", { ascending: false })
    .limit(take)

  if (error || !data?.length) {
    if (error) console.warn("[liveChatVisitorOrders]", error.message)
    return []
  }

  const out: LiveChatVisitorOrderTile[] = []
  for (const row of data as unknown as OrderRow[]) {
    const isBuyer = row.buyer_id === userId
    const isSeller = row.seller_id === userId
    if (!isBuyer && !isSeller) continue

    const listing = listingOf(row)
    const title =
      typeof listing?.title === "string" && listing.title.trim()
        ? listing.title.trim()
        : isBuyer
          ? "Your purchase"
          : "Your sale"
    const thumb = listingTitleThumbnailSrc(listing?.listing_images ?? null)
    out.push({
      orderId: row.id,
      orderNum: formatOrderNumForCustomer(row.order_num, row.id),
      title,
      imageUrl: thumb || null,
      role: isBuyer ? "buyer" : "seller",
    })
  }

  return out
}
