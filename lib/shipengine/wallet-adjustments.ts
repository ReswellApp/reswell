import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"

type ShipEngineWalletAdjustment = {
  transactionId: string
  shipmentId: string | null
  trackingNumber: string | null
  amountUsd: number
  transactionAt: string | null
  description: string | null
}

export type ShipEngineWalletAdjustmentsResult =
  | { ok: true; adjustments: ShipEngineWalletAdjustment[]; transactionsSeen: number }
  | { ok: false; error: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function stringArray(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function moneyAmount(value: unknown): number | null {
  const record = asRecord(value)
  const raw = record?.amount ?? value
  const amount = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(amount) ? amount : null
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function responseError(scope: string, response: Response, body: unknown): string {
  const record = asRecord(body)
  const message =
    stringValue(record ?? {}, "message", "error") ??
    (typeof body === "string" ? body.slice(0, 300) : null)
  return `${scope} failed (${response.status})${message ? `: ${message}` : ""}`
}

function fundingSourceIds(body: unknown): string[] {
  const root = asRecord(body)
  const rows = root?.funding_sources ?? root?.fundingSources
  if (!Array.isArray(rows)) return []
  return rows
    .map((item) => {
      const record = asRecord(item)
      return record
        ? stringValue(record, "funding_source_id", "fundingSourceId", "id")
        : null
    })
    .filter((id): id is string => Boolean(id))
}

function parseAdjustment(record: Record<string, unknown>): ShipEngineWalletAdjustment | null {
  const category = stringValue(record, "transaction_category", "transactionCategory")
  if (category?.toLowerCase() !== "adjustment") return null

  const transactionId = stringValue(
    record,
    "funding_source_transaction_id",
    "fundingSourceTransactionId",
    "transaction_id",
    "transactionId",
  )
  const amount = moneyAmount(record.transaction_amount ?? record.transactionAmount)
  if (!transactionId || amount == null || amount === 0) return null

  return {
    transactionId,
    shipmentId: stringArray(record, "shipment_ids", "shipmentIds")[0] ?? null,
    trackingNumber: stringArray(record, "tracking_numbers", "trackingNumbers")[0] ?? null,
    amountUsd: Math.round(Math.abs(amount) * 100) / 100,
    transactionAt: stringValue(record, "transaction_date", "transactionDate"),
    description: stringValue(record, "description"),
  }
}

/**
 * Lists ShipEngine balance-ledger adjustments, including UPS debits shown in
 * Payment & Subscription → Transaction History.
 */
export async function listShipEngineWalletAdjustments(params?: {
  createdAtStart?: string
  createdAtEnd?: string
}): Promise<ShipEngineWalletAdjustmentsResult> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured" }
  }

  const sourceResponse = await shipEngineRequest("/funding_sources")
  const sourceBody = await readJson(sourceResponse)
  if (!sourceResponse.ok) {
    return { ok: false, error: responseError("ShipEngine funding sources", sourceResponse, sourceBody) }
  }

  const sourceIds = fundingSourceIds(sourceBody)
  if (sourceIds.length === 0) {
    return { ok: false, error: "ShipEngine returned no funding sources" }
  }
  const adjustments: ShipEngineWalletAdjustment[] = []
  let transactionsSeen = 0

  for (const sourceId of sourceIds) {
    for (let page = 1; page <= 20; page += 1) {
      const query = new URLSearchParams({
        page: String(page),
        page_size: "100",
        category: "adjustment",
      })
      if (params?.createdAtStart) query.set("created_at_start", params.createdAtStart)
      if (params?.createdAtEnd) query.set("created_at_end", params.createdAtEnd)

      const response = await shipEngineRequest(
        `/funding_sources/${encodeURIComponent(sourceId)}/transactions?${query.toString()}`,
      )
      const body = await readJson(response)
      if (!response.ok) {
        return {
          ok: false,
          error: responseError("ShipEngine wallet transactions", response, body),
        }
      }

      const root = asRecord(body)
      const rows = Array.isArray(root?.transactions) ? root.transactions : []
      transactionsSeen += rows.length
      for (const item of rows) {
        const record = asRecord(item)
        const adjustment = record ? parseAdjustment(record) : null
        if (adjustment) adjustments.push(adjustment)
      }

      const pagesRaw = root?.pages
      const pages = typeof pagesRaw === "number" ? pagesRaw : Number(pagesRaw)
      if (rows.length === 0 || (Number.isFinite(pages) && page >= pages)) break
    }
  }

  return { ok: true, adjustments, transactionsSeen }
}
