function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function download(csv: string, filename: string): void {
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export type LabelsCreatedExportRow = {
  created_at: string
  orderDisplayNum: string
  order_id: string
  source: string
  tracking_number: string | null
  tracking_carrier: string | null
  label_cost_usd: number | string | null
  label_cost_currency: string | null
  buyer: { display_name: string | null; email: string | null }
  seller: { display_name: string | null; email: string | null }
}

function money(v: number | string | null | undefined): string {
  if (v == null) return ""
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : ""
}

const LABELS_HEADERS = [
  "Created",
  "Order",
  "Order ID",
  "Source",
  "Tracking",
  "Carrier",
  "Label cost",
  "Currency",
  "Buyer",
  "Buyer email",
  "Seller",
  "Seller email",
] as const

export function buildLabelsCreatedCsv(rows: LabelsCreatedExportRow[]): string {
  const out = rows.map((r) => [
    r.created_at,
    `#${r.orderDisplayNum}`,
    r.order_id,
    r.source,
    r.tracking_number ?? "",
    r.tracking_carrier ?? "",
    money(r.label_cost_usd),
    r.label_cost_currency ?? "",
    r.buyer.display_name ?? "",
    r.buyer.email ?? "",
    r.seller.display_name ?? "",
    r.seller.email ?? "",
  ])
  return [LABELS_HEADERS, ...out].map((row) => row.map(csvCell).join(",")).join("\n")
}

export function downloadLabelsCreatedCsv(rows: LabelsCreatedExportRow[]): void {
  download(buildLabelsCreatedCsv(rows), `reswell-shipping-labels-${stamp()}.csv`)
}

export type FailuresExportRow = {
  orderDisplayNum: string
  order_id: string
  failure_stage: string
  error_message: string
  listingTitle: string
  buyerPaidShippingUsd: number | null
  deliveryStatus: string | null
  updated_at: string
  seller: { display_name: string | null; email: string | null }
  buyer: { display_name: string | null; email: string | null }
}

const FAILURES_HEADERS = [
  "Order",
  "Order ID",
  "Listing",
  "Failure stage",
  "Error",
  "Shipping paid",
  "Delivery status",
  "Seller",
  "Buyer",
  "Updated",
] as const

export function buildFailuresCsv(rows: FailuresExportRow[]): string {
  const out = rows.map((r) => [
    `#${r.orderDisplayNum}`,
    r.order_id,
    r.listingTitle,
    r.failure_stage,
    r.error_message,
    r.buyerPaidShippingUsd != null ? r.buyerPaidShippingUsd.toFixed(2) : "",
    r.deliveryStatus ?? "",
    r.seller.display_name ?? r.seller.email ?? "",
    r.buyer.display_name ?? r.buyer.email ?? "",
    r.updated_at,
  ])
  return [FAILURES_HEADERS, ...out].map((row) => row.map(csvCell).join(",")).join("\n")
}

export function downloadFailuresCsv(rows: FailuresExportRow[]): void {
  download(buildFailuresCsv(rows), `reswell-shipping-failures-${stamp()}.csv`)
}

export type LabelSpendExportRow = {
  createdAt: string
  kind: string
  orderDisplayNum: string | null
  orderId: string | null
  trackingNumber: string | null
  carrierCode: string | null
  serviceCode: string | null
  postageUsd: number
  insuranceUsd: number
  chargeUsd: number
  labelId: string
}

const LABEL_SPEND_HEADERS = [
  "Created",
  "Kind",
  "Order",
  "Order ID",
  "Tracking",
  "Carrier",
  "Service",
  "Postage",
  "Insurance",
  "Charge",
  "ShipEngine label",
] as const

export function buildLabelSpendCsv(rows: LabelSpendExportRow[]): string {
  const out = rows.map((r) => [
    r.createdAt,
    r.kind,
    r.orderDisplayNum ? `#${r.orderDisplayNum}` : "",
    r.orderId ?? "",
    r.trackingNumber ?? "",
    r.carrierCode ?? "",
    r.serviceCode ?? "",
    r.postageUsd.toFixed(2),
    r.insuranceUsd.toFixed(2),
    r.chargeUsd.toFixed(2),
    r.labelId,
  ])
  return [LABEL_SPEND_HEADERS, ...out].map((row) => row.map(csvCell).join(",")).join("\n")
}

export function downloadLabelSpendCsv(rows: LabelSpendExportRow[], dateFrom: string, dateTo: string): void {
  download(buildLabelSpendCsv(rows), `reswell-shipengine-label-spend-${dateFrom}-${dateTo}.csv`)
}
