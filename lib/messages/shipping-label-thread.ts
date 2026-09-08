import { formatCarrierServiceDisplay } from "@/lib/shipping/resolve-carrier-code"
import { parseShippingLabelMessageContent } from "@/lib/messages/parse-shipping-label-content"
import {
  parseShippingLabelMessageMetadata,
  type ShippingLabelMessagePayload,
} from "@/lib/validations/shipping-label-message-metadata"

export type ShippingLabelThreadPayload = {
  source: "reswell" | "admin"
  orderId: string | null
  orderNum: string | null
  listingTitle: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
  hasPaperlessQr: boolean
}

export function buildShippingLabelThreadPlainText(params: {
  orderNum: string
  listingTitle: string
  trackingNumber: string | null
  trackingCarrier: string | null
}): string {
  const title = params.listingTitle.trim() || "Item"
  const track = params.trackingNumber?.trim() || null
  const carrier = formatCarrierServiceDisplay(params.trackingCarrier)
  const lines = [`Shipping label ready — order #${params.orderNum}`, title]
  if (track && carrier) lines.push(`Tracking ${track} · ${carrier}`)
  else if (track) lines.push(`Tracking ${track}`)
  else if (carrier) lines.push(carrier)
  return lines.join("\n")
}

function httpUrlOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

function toShippingLabelThreadPayload(
  meta: ShippingLabelMessagePayload,
): ShippingLabelThreadPayload {
  return {
    source: meta.kind === "admin_shipping_label" ? "admin" : "reswell",
    orderId: meta.orderId,
    orderNum: meta.orderNum?.trim() || null,
    listingTitle: meta.listingTitle?.trim() || null,
    trackingNumber: meta.trackingNumber?.trim() || null,
    trackingCarrier: meta.trackingCarrier?.trim() || null,
    labelPdfUrl: httpUrlOrNull(meta.labelPdfUrl),
    hasPaperlessQr: Boolean(meta.hasPaperlessQr),
  }
}

function firstText(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a?.trim() || null
  const right = b?.trim() || null
  return left ?? right
}

export function parseShippingLabelThreadMessage(
  content: string,
  metadata?: unknown,
): ShippingLabelThreadPayload | null {
  const fromMeta = parseShippingLabelMessageMetadata(metadata)
  const fromContent = parseShippingLabelMessageContent(content)
  if (!fromMeta && !fromContent) return null

  const metaPayload = fromMeta ? toShippingLabelThreadPayload(fromMeta) : null
  return {
    source: metaPayload?.source ?? fromContent?.source ?? "reswell",
    orderId: metaPayload?.orderId ?? null,
    orderNum: firstText(metaPayload?.orderNum, fromContent?.orderNum),
    listingTitle: firstText(metaPayload?.listingTitle, fromContent?.listingTitle),
    trackingNumber: firstText(metaPayload?.trackingNumber, fromContent?.trackingNumber),
    trackingCarrier: firstText(metaPayload?.trackingCarrier, fromContent?.trackingCarrier),
    labelPdfUrl: metaPayload?.labelPdfUrl ?? fromContent?.labelPdfUrl ?? null,
    hasPaperlessQr: Boolean(metaPayload?.hasPaperlessQr || fromContent?.hasPaperlessQr),
  }
}
