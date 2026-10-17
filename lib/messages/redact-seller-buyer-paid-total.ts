import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { parseOrderPlacedMessageMetadata } from "@/lib/validations/order-placed-message-metadata"

type PromoOrderAmountRow = {
  id: string
  amount: number | string | null
  shipping_amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string | null
  promo_discount_usd: number | string | null
}

type ThreadMessage = {
  content?: unknown
  metadata?: unknown
}

/**
 * Seller view of an order-placed thread card. When a Reswell promo reduced checkout,
 * replace the buyer-paid total with the seller-facing sale total so the discounted
 * charge never reaches the seller.
 */
export function sellerOrderPlacedMessageWithoutBuyerPaid<T extends ThreadMessage>(
  message: T,
  sellerSaleTotal: number,
  buyerPaidTotal: number,
): T {
  if (!Number.isFinite(sellerSaleTotal) || !Number.isFinite(buyerPaidTotal)) return message
  if (Math.round(sellerSaleTotal * 100) === Math.round(buyerPaidTotal * 100)) return message

  const paidLabel = `$${buyerPaidTotal.toFixed(2)} total`
  const saleLabel = `$${sellerSaleTotal.toFixed(2)} total`
  const content =
    typeof message.content === "string" ? message.content.replaceAll(paidLabel, saleLabel) : message.content

  const parsed = parseOrderPlacedMessageMetadata(message.metadata)
  if (!parsed || !message.metadata || typeof message.metadata !== "object" || Array.isArray(message.metadata)) {
    return content === message.content ? message : { ...message, content }
  }

  return {
    ...message,
    content,
    metadata: {
      ...(message.metadata as Record<string, unknown>),
      total: sellerSaleTotal,
    },
  }
}

/**
 * Rewrites order-placed messages before they are sent to a seller.
 * No-op when the order had no Reswell promo.
 */
export async function redactPromoBuyerPaidTotalsForSeller<T extends ThreadMessage>(
  supabase: SupabaseClient,
  messages: T[],
): Promise<T[]> {
  const orderIds = new Set<string>()
  for (const message of messages) {
    const placed = parseOrderPlacedMessageMetadata(message.metadata)
    if (placed) orderIds.add(placed.orderId)
  }
  if (orderIds.size === 0) return messages

  const { data, error } = await supabase
    .from("orders")
    .select("id, amount, shipping_amount, platform_fee, seller_earnings, promo_discount_usd")
    .in("id", [...orderIds])

  if (error || !data) {
    if (error) console.error("[redactPromoBuyerPaidTotalsForSeller]", error.message)
    return messages
  }

  const byId = new Map<string, ReturnType<typeof resolveSellerOrderDisplayAmounts>>()
  for (const row of data as PromoOrderAmountRow[]) {
    const display = resolveSellerOrderDisplayAmounts({
      amount: row.amount ?? 0,
      shipping_amount: row.shipping_amount,
      platform_fee: row.platform_fee,
      seller_earnings: row.seller_earnings ?? 0,
      promo_discount_usd: row.promo_discount_usd,
    })
    if (display.hadReswellPromo) byId.set(row.id, display)
  }
  if (byId.size === 0) return messages

  return messages.map((message) => {
    const placed = parseOrderPlacedMessageMetadata(message.metadata)
    if (!placed) return message
    const display = byId.get(placed.orderId)
    if (!display) return message
    return sellerOrderPlacedMessageWithoutBuyerPaid(message, display.sellerSaleTotal, placed.total)
  })
}
