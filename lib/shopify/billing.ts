import { getMarketplaceFee, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import type {
  ShopifyBillingStatus,
  ShopifySaleCollectVia,
  ShopifySourceOfTruth,
} from "@/lib/shopify/types"

/** Monthly usage cap the merchant approves. 7% of item price is charged inside it. */
export const SHOPIFY_USAGE_CAP_USD = 10_000

export const SHOPIFY_USAGE_TERMS =
  "Reswell charges 7% of the item price for each connected sale. That charge is the only Reswell fee on the sale."

export const SHOPIFY_SOURCE_METAFIELD_NAMESPACE = "$app"
export const SHOPIFY_SOURCE_METAFIELD_KEY = "source_of_truth"
export const SHOPIFY_ORDER_TAG = "Reswell"
export const RESWELL_ORDER_ATTRIBUTE = "reswell_order_id"

export function shopifySaleIdempotencyKey(orderId: string): string {
  return orderId
}

export function parseShopifySourceOfTruth(
  value: string | null | undefined,
): ShopifySourceOfTruth | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "shopify" || normalized === "reswell") return normalized
  return null
}

export function shopifyCatalogSyncAllowed(connection: {
  status: string
  sync_enabled: boolean
  billing_status: ShopifyBillingStatus
}): boolean {
  return (
    connection.status === "active" &&
    connection.sync_enabled &&
    connection.billing_status === "active"
  )
}

/**
 * Shopify-connected sales with an approved usage plan pay 7% through Shopify
 * Billing. The Stripe payout is the full item price. Every other sale keeps
 * the current payout fee.
 */
export function connectedSalePayout(
  itemPriceUsd: number,
  options: { feeWaived: boolean; shopifyBilled: boolean },
): {
  platformFee: number
  sellerEarnings: number
  shopifyUsageFee: number
} {
  const itemPrice = Math.round(itemPriceUsd * 100) / 100
  if (options.shopifyBilled) {
    return {
      platformFee: 0,
      sellerEarnings: itemPrice,
      shopifyUsageFee: getMarketplaceFee(itemPrice),
    }
  }
  const fee = options.feeWaived ? 0 : getMarketplaceFee(itemPrice)
  return {
    platformFee: fee,
    sellerEarnings: Math.round((itemPrice - fee) * 100) / 100,
    shopifyUsageFee: 0,
  }
}

export function shopifyUsageAmountUsd(itemPriceUsd: number): number {
  return getMarketplaceFee(Math.round(itemPriceUsd * 100) / 100)
}

export function shopifyCollectVia(
  billingStatus: ShopifyBillingStatus,
): ShopifySaleCollectVia {
  return billingStatus === "active" ? "shopify" : "stripe"
}

/** Shopify-managed listings can be bought only while the usage charge is active. */
export function shopifyManagedListingSaleAllowed(input: {
  inventorySource: string | null | undefined
  billingStatus: string | null | undefined
}): boolean {
  if (input.inventorySource !== "shopify") return true
  return input.billingStatus === "active"
}

export const SHOPIFY_MANAGED_SALE_BLOCKED_MESSAGE =
  "This Shopify item is not available for purchase."

export function isReswellOriginatedShopifyOrder(input: {
  tags?: string | null
  note?: string | null
  noteAttributes?: Array<{ name?: string | null; value?: string | null }> | null
}): boolean {
  const tags = (input.tags ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
  if (tags.includes(SHOPIFY_ORDER_TAG.toLowerCase())) return true
  if ((input.note ?? "").toLowerCase().includes("reswell order")) return true
  return Boolean(
    input.noteAttributes?.some(
      (attribute) =>
        attribute.name === RESWELL_ORDER_ATTRIBUTE && Boolean(attribute.value?.trim()),
    ),
  )
}

export const SHOPIFY_BILLING_RATE_LABEL = `${MARKETPLACE_FEE_PERCENT}%`
