import { formatKlaviyoPriceDisplay } from "@/lib/klaviyo/catalog-product"
import type { CheckoutPromoKind } from "@/lib/services/checkoutPromo"

export type KlaviyoOrderChargeLine = {
  label: string
  amount: number
  amount_display: string
  /** True for promo / credit rows shown before the total. */
  is_discount: boolean
}

/** Currency display for checkout line items (shows cents when needed). */
export function formatKlaviyoOrderAmountDisplay(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return ""
  const rounded = Math.round(price * 100) / 100
  const hasCents = Math.abs(rounded - Math.round(rounded)) > 0.001
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(rounded)
  } catch {
    return formatKlaviyoPriceDisplay(rounded)
  }
}

/** Order-summary row label for a redeemed promo (includes code when known). */
export function klaviyoPromoLabelForEmail(input: {
  promoCode?: string | null
  promoKind?: CheckoutPromoKind | null
  promoLabel?: string | null
}): string {
  const code = input.promoCode?.trim()
  if (!code) return input.promoLabel?.trim() || "Promo discount"
  const base =
    input.promoLabel?.trim() ||
    (input.promoKind === "newsletter" ? "Newsletter discount" : "Promo discount")
  return `${base} (${code})`
}

export function buildKlaviyoOrderChargesForEmail(input: {
  shippingAmountUsd?: number | null
  promoDiscountUsd?: number | null
  promoCode?: string | null
  promoKind?: CheckoutPromoKind | null
  promoLabel?: string | null
}): KlaviyoOrderChargeLine[] {
  const charges: KlaviyoOrderChargeLine[] = []

  const shipping = Math.max(0, Math.round((Number(input.shippingAmountUsd ?? 0) || 0) * 100) / 100)
  if (shipping > 0) {
    charges.push({
      label: "Shipping",
      amount: shipping,
      amount_display: formatKlaviyoOrderAmountDisplay(shipping),
      is_discount: false,
    })
  }

  const discount = Math.max(0, Math.round((Number(input.promoDiscountUsd ?? 0) || 0) * 100) / 100)
  if (discount > 0) {
    const formatted = formatKlaviyoOrderAmountDisplay(discount)
    charges.push({
      label: klaviyoPromoLabelForEmail(input),
      amount: -discount,
      amount_display: formatted ? `−${formatted}` : "",
      is_discount: true,
    })
  }

  return charges
}

export function klaviyoBuyerOrderPriceProperties(input: {
  amount: number
  itemSubtotalUsd?: number | null
  shippingAmountUsd?: number | null
  promoDiscountUsd?: number | null
  promoCode?: string | null
  promoKind?: CheckoutPromoKind | null
  promoLabel?: string | null
  lineItems?: Array<{ price: number; quantity?: number | null }>
}): {
  item_subtotal_usd: number
  item_subtotal_display: string
  shipping_amount: number
  shipping_amount_display: string
  promo_code: string
  promo_label: string
  promo_discount_usd: number
  promo_discount_display: string
  order_total_display: string
  order_charges: KlaviyoOrderChargeLine[]
} {
  const shipping = Math.max(0, Math.round((Number(input.shippingAmountUsd ?? 0) || 0) * 100) / 100)
  const discount = Math.max(0, Math.round((Number(input.promoDiscountUsd ?? 0) || 0) * 100) / 100)
  const total = Math.round((Number(input.amount) || 0) * 100) / 100

  const itemSubtotal =
    input.itemSubtotalUsd != null && Number.isFinite(Number(input.itemSubtotalUsd))
      ? Math.round(Number(input.itemSubtotalUsd) * 100) / 100
      : input.lineItems?.length
        ? Math.round(
            input.lineItems.reduce(
              (sum, line) => sum + line.price * Math.max(1, line.quantity ?? 1),
              0,
            ) * 100,
          ) / 100
        : Math.round((total + discount - shipping) * 100) / 100

  const promoCode = input.promoCode?.trim() ?? ""
  const promoLabel = klaviyoPromoLabelForEmail({
    promoCode,
    promoKind: input.promoKind,
    promoLabel: input.promoLabel,
  })

  const orderCharges = buildKlaviyoOrderChargesForEmail({
    shippingAmountUsd: shipping,
    promoDiscountUsd: discount,
    promoCode,
    promoKind: input.promoKind,
    promoLabel: input.promoLabel,
  })

  return {
    item_subtotal_usd: itemSubtotal,
    item_subtotal_display: formatKlaviyoOrderAmountDisplay(itemSubtotal),
    shipping_amount: shipping,
    shipping_amount_display:
      shipping > 0 ? formatKlaviyoOrderAmountDisplay(shipping) : "",
    promo_code: promoCode,
    promo_label: discount > 0 ? promoLabel : "",
    promo_discount_usd: discount,
    promo_discount_display:
      discount > 0 ? `−${formatKlaviyoOrderAmountDisplay(discount)}` : "",
    order_total_display: formatKlaviyoOrderAmountDisplay(total),
    order_charges: orderCharges,
  }
}
