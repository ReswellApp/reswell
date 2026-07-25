import type { OfferLineItem } from "@/lib/types/offer-line-item"

export type SellerOfferThreadContentInput = {
  itemsSubtotal: number
  fulfillment: "pickup" | "shipping"
  shippingAmount: number | null
  lineItems: OfferLineItem[]
  note: string | null
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`
}

function fulfillmentLabel(fulfillment: "pickup" | "shipping", shippingAmount: number | null): string {
  if (fulfillment === "pickup") return "Local pickup"
  if (shippingAmount === 0) return "Free shipping"
  if (shippingAmount != null && shippingAmount > 0) {
    return `Shipping (+${formatMoney(shippingAmount)})`
  }
  return "Shipping (Reswell rate at checkout)"
}

function bundleSummary(lineItems: OfferLineItem[]): string {
  if (lineItems.length <= 1) return ""
  const parts = lineItems.map((row) => {
    const title = row.title?.trim() || "Item"
    return `${title} ${formatMoney(row.amount)}`
  })
  return `Bundle (${lineItems.length} items): ${parts.join("; ")}`
}

/** Seller-initiated offer mirrored into the message thread. */
export function formatSellerOfferThreadContent(input: SellerOfferThreadContentInput): string
/** @deprecated Use the object form — kept for callers passing (amount, note). */
export function formatSellerOfferThreadContent(amount: number, note: string | null): string
export function formatSellerOfferThreadContent(
  inputOrAmount: SellerOfferThreadContentInput | number,
  legacyNote?: string | null,
): string {
  if (typeof inputOrAmount === "number") {
    const a = Number.isFinite(inputOrAmount) ? inputOrAmount : 0
    const note = legacyNote ?? null
    return note !== null && note.trim() !== ""
      ? `Offer from seller: $${a.toFixed(2)} — ${note.trim()}`
      : `Offer from seller: $${a.toFixed(2)}`
  }

  const { itemsSubtotal, fulfillment, shippingAmount, lineItems, note } = inputOrAmount
  const subtotal = Number.isFinite(itemsSubtotal) ? itemsSubtotal : 0
  const fulfill = fulfillmentLabel(fulfillment, shippingAmount)
  const bundle = bundleSummary(lineItems)
  const total =
    fulfillment === "shipping" && shippingAmount != null
      ? subtotal + shippingAmount
      : subtotal

  const parts = [
    `Offer from seller: ${formatMoney(total)} total`,
    bundle,
    fulfill,
    note?.trim() ? note.trim() : null,
  ].filter(Boolean)

  return parts.join(" — ")
}

/** Single source for mirrored chat text so sync + create stay identical. */
export function formatOfferThreadContent(amount: number, note: string | null): string {
  const a = Number.isFinite(amount) ? amount : 0
  return note !== null && note.trim() !== ""
    ? `Offer: $${a.toFixed(2)} — ${note.trim()}`
    : `Offer: $${a.toFixed(2)}`
}
