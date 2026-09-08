import { formatCarrierServiceDisplay } from "@/lib/shipping/resolve-carrier-code"
import { parseOrderShippedMessageContent } from "@/lib/messages/parse-order-shipped-content"
import {
  parseOrderShippedMessageMetadata,
  type OrderShippedMessagePayload,
} from "@/lib/validations/order-shipped-message-metadata"

export type OrderShippedThreadPayload = {
  orderId: string | null
  orderNum: string | null
  listingTitle: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
}

export function buildOrderShippedPlainText(params: {
  listingTitle: string
  trackingNumber: string
  trackingCarrier: string | null
}): string {
  const title = params.listingTitle.trim() || "your item"
  const track = params.trackingNumber.trim()
  const carrier = formatCarrierServiceDisplay(params.trackingCarrier)
  const trackLine = carrier ? `Tracking ${track} · ${carrier}` : `Tracking ${track}`
  return [`Your order shipped — ${title}`, trackLine].join("\n")
}

function firstText(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a?.trim() || null
  const right = b?.trim() || null
  return left ?? right
}

export function parseOrderShippedThreadMessage(
  content: string,
  metadata?: unknown,
): OrderShippedThreadPayload | null {
  const fromMeta = parseOrderShippedMessageMetadata(metadata)
  const fromContent = parseOrderShippedMessageContent(content)
  if (!fromMeta && !fromContent) return null

  return mergeShippedPayload(fromMeta, fromContent)
}

function mergeShippedPayload(
  fromMeta: OrderShippedMessagePayload | null,
  fromContent: ReturnType<typeof parseOrderShippedMessageContent>,
): OrderShippedThreadPayload {
  return {
    orderId: fromMeta?.orderId ?? null,
    orderNum: firstText(fromMeta?.orderNum, fromContent?.orderNum),
    listingTitle: firstText(fromMeta?.listingTitle, fromContent?.listingTitle),
    trackingNumber: firstText(fromMeta?.trackingNumber, fromContent?.trackingNumber),
    trackingCarrier: firstText(fromMeta?.trackingCarrier, fromContent?.trackingCarrier),
  }
}
