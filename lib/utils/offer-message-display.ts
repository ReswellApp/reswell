import type { OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { parseOfferLineItems, type OfferLineItem } from "@/lib/types/offer-line-item"
import { resolveOfferThreadNote } from "@/lib/utils/parse-offer-negotiation-message"

function parseMoney(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function parseShippingAmount(v: unknown): number | null {
  if (v == null) return null
  const n = parseMoney(v)
  return Number.isFinite(n) ? n : null
}

export type OfferMessageDisplay = {
  headline: string
  amount: string
  contextLine?: string
  note?: string
  lineItems?: OfferLineItem[]
  fulfillmentLabel?: string
  itemsSubtotal?: string
  shippingAmount?: string
}

export function offerFulfillmentLabel(
  fulfillment: string | null | undefined,
  shippingAmount: number | null,
): string | undefined {
  if (fulfillment === "pickup") return "Local pickup"
  if (fulfillment === "shipping") {
    if (shippingAmount === 0) return "Free shipping"
    if (shippingAmount != null && shippingAmount > 0) {
      return `Shipping (+$${shippingAmount.toFixed(2)})`
    }
    return "Shipping (Reswell rate at checkout)"
  }
  return undefined
}

function bundleContextLine(lineItems: OfferLineItem[]): string | undefined {
  if (lineItems.length <= 1) return undefined
  return `${lineItems.length} items bundled`
}

/** Structured copy for offer cards in message threads — avoids raw mirrored prefixes. */
export function buildOfferMessageDisplay(
  offer: OfferRowLite,
  messageContent: string,
  isSeller: boolean,
): OfferMessageDisplay {
  const lineItems = parseOfferLineItems(offer.line_items) ?? undefined
  const itemsSubtotal = parseMoney(offer.current_amount)
  const shippingAmount = parseShippingAmount(offer.shipping_amount)
  const fulfillment = offer.fulfillment ?? null

  const total =
    fulfillment === "shipping" && shippingAmount != null
      ? itemsSubtotal + shippingAmount
      : itemsSubtotal

  const initial = parseMoney(offer.initial_amount ?? offer.current_amount)
  const note =
    resolveOfferThreadNote(messageContent, offer.offer_timeline, {
      sellerInitiated: !!offer.seller_initiated,
    }) ?? undefined

  const amount = `$${total.toFixed(2)}`
  const fulfillLabel = offerFulfillmentLabel(fulfillment, shippingAmount)
  const bundleLine = lineItems ? bundleContextLine(lineItems) : undefined

  const base: Pick<OfferMessageDisplay, "note" | "lineItems" | "fulfillmentLabel" | "itemsSubtotal" | "shippingAmount"> =
    {
      note,
      lineItems,
      fulfillmentLabel: fulfillLabel,
      itemsSubtotal:
        lineItems && lineItems.length > 1 ? `$${itemsSubtotal.toFixed(2)} items` : undefined,
      shippingAmount:
        fulfillment === "shipping" && shippingAmount != null && shippingAmount > 0
          ? `$${shippingAmount.toFixed(2)}`
          : undefined,
    }

  const sellerInitiated = !!offer.seller_initiated

  switch (offer.status) {
    case "PENDING":
      return {
        headline: isSeller ? "New offer from buyer" : "Your offer",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    case "COUNTERED":
      if (sellerInitiated) {
        return {
          headline: isSeller ? "Your offer to buyer" : "Offer from seller",
          amount,
          contextLine: bundleLine,
          ...base,
        }
      }
      return {
        headline: isSeller ? "Your counteroffer" : "Seller counteroffer",
        amount,
        contextLine:
          bundleLine ??
          (initial !== itemsSubtotal ? `Buyer offered $${initial.toFixed(2)}` : undefined),
        ...base,
      }
    case "ACCEPTED":
      return {
        headline: "Offer accepted",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    case "DECLINED":
      return {
        headline: "Offer declined",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    case "EXPIRED":
      return {
        headline: "Offer expired",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    case "WITHDRAWN":
      return {
        headline: "Offer withdrawn",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    case "COMPLETED":
      return {
        headline: "Purchase completed",
        amount,
        contextLine: bundleLine,
        ...base,
      }
    default:
      return {
        headline: "Offer update",
        amount,
        contextLine: bundleLine,
        ...base,
      }
  }
}
