export const USPS_LABEL_BROKER_FINDER =
  "https://tools.usps.com/find-location.htm?locationType=po&serviceType=lbroretail"

export type OrderPaperlessQrSummary = {
  paperlessInstructions: string | null
  paperlessHandoffCode: string | null
}

export type PaperlessQrLabelRow = {
  order_id?: string | null
  created_at?: string | null
  paperless_qr_url?: string | null
  paperless_qr_storage_path?: string | null
  paperless_instructions?: string | null
  paperless_handoff_code?: string | null
}

export function paperlessQrRowHasImage(
  row: Pick<PaperlessQrLabelRow, "paperless_qr_url" | "paperless_qr_storage_path">,
): boolean {
  return Boolean(row.paperless_qr_url?.trim() || row.paperless_qr_storage_path?.trim())
}

function rowCreatedAtMs(value: string | null | undefined): number {
  if (!value?.trim()) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Latest paperless QR per order. Later rows win on equal timestamps. */
export function pickLatestPaperlessQrByOrderId(
  rows: PaperlessQrLabelRow[],
): Map<string, OrderPaperlessQrSummary> {
  const latestAt = new Map<string, number>()
  const out = new Map<string, OrderPaperlessQrSummary>()
  for (const row of rows) {
    const orderId = row.order_id?.trim()
    if (!orderId || !paperlessQrRowHasImage(row)) continue
    const at = rowCreatedAtMs(row.created_at)
    const prev = latestAt.get(orderId)
    if (prev != null && prev > at) continue
    latestAt.set(orderId, at)
    out.set(orderId, {
      paperlessInstructions: row.paperless_instructions?.trim() || null,
      paperlessHandoffCode: row.paperless_handoff_code?.trim() || null,
    })
  }
  return out
}

export function sellerShippingLabelQrHref(params: {
  orderId: string
  labelId?: string | null
  downloadApiPrefix?: string
}): string {
  const prefix = (params.downloadApiPrefix ?? "/api/orders").replace(/\/$/, "")
  const encodedId = encodeURIComponent(params.orderId)
  const labelId = params.labelId?.trim()
  const query = labelId ? `?label_id=${encodeURIComponent(labelId)}` : ""
  return `${prefix}/${encodedId}/shipping-label/qr${query}`
}

export function sellerOpenShipmentLabelStatus(input: {
  hasPrintableLabel: boolean
  hasPaperlessQr: boolean
}): string {
  if (input.hasPrintableLabel && input.hasPaperlessQr) return "Label and USPS QR ready"
  if (input.hasPaperlessQr) return "USPS QR ready"
  if (input.hasPrintableLabel) return "Label ready to print"
  return "Needs a shipping label"
}
