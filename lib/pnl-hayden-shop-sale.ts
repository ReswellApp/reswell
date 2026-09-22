import type { PnlEntryInsert, PnlEntryUpdate, ReswellListingOption } from "@/lib/db/pnl"

export interface HaydenShopPnlSale {
  listingId: string
  salePrice: number
  saleDate: string
  orderId?: string | null
  orderNum?: string | null
  platformFee?: number
}

export function buildHaydenShopPnlSaleUpdate(sale: HaydenShopPnlSale): PnlEntryUpdate {
  const saleDate = sale.saleDate.slice(0, 10)
  const values: PnlEntryUpdate = {
    status: "sold",
    sale_price: sale.salePrice,
    sale_date: saleDate,
  }
  if (sale.orderId) {
    values.order_id = sale.orderId
    values.order_num = sale.orderNum ?? null
    values.order_role = "seller"
  }
  if (sale.platformFee != null) {
    values.platform_fee = sale.platformFee
  }
  return values
}

export function haydenShopListingToPnlInsert(
  listing: ReswellListingOption,
  createdBy: string,
): PnlEntryInsert | null {
  if (listing.status !== "active" && listing.status !== "sold") return null
  const sold = listing.status === "sold"
  const saleDate = listing.sale_date ? listing.sale_date.slice(0, 10) : null
  return {
    board_name: listing.board_name,
    category: listing.category,
    status: sold ? "sold" : "listed",
    source_kind: "outside",
    bought_from: null,
    purchase_price: 0,
    purchase_date: null,
    asking_price: listing.price,
    sale_price: sold ? (listing.sale_price ?? listing.price) : null,
    sale_date: sold ? saleDate : null,
    shipping_cost: 0,
    platform_fee: sold ? listing.platform_fee : 0,
    other_costs: 0,
    notes: null,
    order_id: listing.order_id,
    listing_id: listing.listing_id,
    order_role: listing.order_id ? "seller" : null,
    order_num: listing.order_num,
    listing_slug: listing.listing_slug,
    created_by: createdBy,
  }
}
