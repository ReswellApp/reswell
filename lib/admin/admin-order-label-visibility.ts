/** Staff order page shows a purchased label when a PDF or USPS QR is on file. */
export function adminOrderShowsShippingLabel(input: {
  fulfillmentMethod: string | null
  hasPdf: boolean
  hasPaperlessQr: boolean
}): boolean {
  return input.fulfillmentMethod === "shipping" && (input.hasPdf || input.hasPaperlessQr)
}

/**
 * Admin download for a label saved on the order.
 * Seller chat strips the carrier URL for Santa Barbara drop-off; this route
 * reads the stored file instead.
 */
export function adminShippingLabelMessageLinks(orderId: string | null | undefined): {
  viewHref: string
  downloadHref: string
} | null {
  const id = orderId?.trim() ?? ""
  if (!id) return null
  const downloadHref = `/api/admin/orders/${encodeURIComponent(id)}/shipping-label/download`
  return {
    downloadHref,
    viewHref: `${downloadHref}?inline=1`,
  }
}
