import { shipEngineRequest } from "@/lib/shipengine/client"
import { getShipEngineApiBase, isShipEngineConfigured } from "@/lib/shipengine/config"

export type ShipEngineAdjustmentReportMeta = {
  reportId: string
  createdAt: string | null
  href: string | null
}

export type ParsedShipEngineAdjustmentRow = {
  transactionId: string
  adjustmentId: string | null
  shipmentId: string | null
  trackingNumber: string | null
  adjustmentType: string | null
  reasonCode: string | null
  adjustmentAmountUsd: number
  adjustmentAt: string | null
  actualService: string | null
  actualPackage: string | null
  actualWeight: number | null
  actualLength: number | null
  actualWidth: number | null
  actualHeight: number | null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function textOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function parseNumber(v: string | null): number | null {
  if (!v) return null
  const n = Number(v.replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : null
}

function parseIsoDate(v: string | null): string | null {
  if (!v) return null
  const parsed = Date.parse(v.replace(" ", "T"))
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

/** Minimal CSV row splitter that honors double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(current)
      current = ""
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, ""))
  for (const alias of aliases) {
    const key = alias.toLowerCase().replace(/[\s_]+/g, "")
    const idx = normalized.indexOf(key)
    if (idx >= 0) return idx
  }
  return -1
}

export function parseShipEngineAdjustmentCsv(csv: string): ParsedShipEngineAdjustmentRow[] {
  const text = csv.replace(/^\uFEFF/, "").trim()
  if (!text) return []
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const iTxn = headerIndex(headers, "TransactionID", "transaction_id")
  const iAdjId = headerIndex(headers, "AdjustmentID", "adjustment_id")
  const iShipment = headerIndex(headers, "ShipmentID", "shipment_id")
  const iTracking = headerIndex(headers, "TrackingNumber", "ActualTrackingNumber", "tracking_number")
  const iType = headerIndex(headers, "AdjustmentType", "adjustment_type")
  const iReason = headerIndex(headers, "ReasonCode", "reason_code")
  const iAmount = headerIndex(headers, "AdjustmentAmount", "adjustment_amount")
  const iDate = headerIndex(headers, "AdjustmentDate", "adjustment_date")
  const iService = headerIndex(headers, "ActualService")
  const iPackage = headerIndex(headers, "ActualPackage")
  const iWeight = headerIndex(headers, "ActualWeight")
  const iLength = headerIndex(headers, "ActualLength")
  const iWidth = headerIndex(headers, "ActualWidth")
  const iHeight = headerIndex(headers, "ActualHeight")

  const rows: ParsedShipEngineAdjustmentRow[] = []
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const cell = (idx: number) => (idx >= 0 ? textOrNull(cols[idx] ?? "") : null)
    const amount = parseNumber(cell(iAmount))
    if (amount == null) continue

    const trackingNumber = cell(iTracking)
    const shipmentId = cell(iShipment)
    const transactionId =
      cell(iTxn) ??
      [trackingNumber, shipmentId, String(amount), cell(iDate)].filter(Boolean).join(":")
    if (!transactionId) continue

    rows.push({
      transactionId,
      adjustmentId: cell(iAdjId),
      shipmentId,
      trackingNumber,
      adjustmentType: cell(iType),
      reasonCode: cell(iReason),
      adjustmentAmountUsd: Math.round(amount * 100) / 100,
      adjustmentAt: parseIsoDate(cell(iDate)),
      actualService: cell(iService),
      actualPackage: cell(iPackage),
      actualWeight: parseNumber(cell(iWeight)),
      actualLength: parseNumber(cell(iLength)),
      actualWidth: parseNumber(cell(iWidth)),
      actualHeight: parseNumber(cell(iHeight)),
    })
  }
  return rows
}

function extractHref(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  const rec = asRecord(value)
  if (!rec) return null
  if (typeof rec.href === "string" && rec.href.trim()) return rec.href.trim()
  return null
}

function pathFromShipEngineUrl(href: string): string {
  const base = getShipEngineApiBase().replace(/\/$/, "")
  if (href.startsWith(base)) {
    const suffix = href.slice(base.length)
    return suffix.startsWith("/") ? suffix : `/${suffix}`
  }
  try {
    const url = new URL(href)
    const marker = "/v1/"
    const idx = url.pathname.indexOf(marker)
    if (idx >= 0) return url.pathname.slice(idx + marker.length - 1)
  } catch {
    /* use as-is */
  }
  return href.startsWith("/") ? href : `/${href}`
}

export async function listShipEngineAdjustmentReports(): Promise<
  { ok: true; reports: ShipEngineAdjustmentReportMeta[] } | { ok: false; error: string }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured" }
  }

  const reports: ShipEngineAdjustmentReportMeta[] = []
  let page = 1
  const pageSize = 100

  for (let safety = 0; safety < 20; safety += 1) {
    const res = await shipEngineRequest(
      `/incubator/adjustments/reports?page=${page}&page_size=${pageSize}&sort_dir=desc&sort_by=created_at`,
    )
    const body = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      return { ok: false, error: `Could not list adjustment reports (${res.status})` }
    }
    const rec = asRecord(body)
    const raw = Array.isArray(rec?.reports) ? rec.reports : []
    for (const item of raw) {
      const row = asRecord(item)
      if (!row) continue
      const reportId = textOrNull(row.report_id)
      if (!reportId) continue
      reports.push({
        reportId,
        createdAt: textOrNull(row.created_at),
        href: extractHref(row.report_download) ?? extractHref(asRecord(row.report_url)),
      })
    }
    const pages = typeof rec?.pages === "number" ? rec.pages : page
    if (page >= pages || raw.length === 0) break
    page += 1
  }

  return { ok: true, reports }
}

export async function downloadShipEngineAdjustmentReport(
  report: Pick<ShipEngineAdjustmentReportMeta, "reportId" | "href">,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured" }
  }

  const path = report.href
    ? pathFromShipEngineUrl(report.href)
    : `/incubator/adjustments/reports/${encodeURIComponent(report.reportId)}`

  const res = await shipEngineRequest(path)
  const csv = await res.text()
  if (!res.ok) {
    return { ok: false, error: `Could not download report ${report.reportId} (${res.status})` }
  }
  const header = csv.split(/\r?\n/, 1)[0] ?? ""
  if (!/adjustment/i.test(header)) {
    return { ok: false, error: `Report ${report.reportId} was not a CSV adjustment file` }
  }
  return { ok: true, csv }
}
