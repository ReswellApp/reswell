const LABEL_PDF_LINE = /label\s*\(pdf\)\s*:\s*\S+/gi
const SHIPENGINE_URL = /https?:\/\/\S*shipengine\S+/gi
const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ShippingLabelMessage = {
  content?: unknown
  metadata?: unknown
}

/** Order id stored on a shipping-label thread message, when the row is one. */
export function shippingLabelOrderIdFromMessage(
  message: ShippingLabelMessage,
): string | null {
  const metadata = message.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const kind = (metadata as { kind?: unknown }).kind
  if (kind !== "admin_shipping_label" && kind !== "shipping_label_ready") return null
  const orderId = (metadata as { orderId?: unknown }).orderId
  return typeof orderId === "string" && ORDER_ID_RE.test(orderId) ? orderId : null
}

/**
 * Removes carrier-label URLs and paperless flags from a seller-visible message.
 * Tracking text stays so the buyer thread still shows the shipment.
 */
export function redactShippingLabelArtifactsFromMessage<T extends ShippingLabelMessage>(
  message: T,
): T {
  const content =
    typeof message.content === "string"
      ? message.content.replace(SHIPENGINE_URL, "").replace(LABEL_PDF_LINE, "").trim()
      : message.content

  if (!message.metadata || typeof message.metadata !== "object" || Array.isArray(message.metadata)) {
    return content === message.content ? message : { ...message, content }
  }

  const metadata = { ...(message.metadata as Record<string, unknown>) }
  let changed = content !== message.content
  if ("labelPdfUrl" in metadata && metadata.labelPdfUrl != null) {
    metadata.labelPdfUrl = null
    changed = true
  }
  if (metadata.hasPaperlessQr === true) {
    metadata.hasPaperlessQr = false
    changed = true
  }
  if (!changed) return message
  return { ...message, content, metadata }
}
