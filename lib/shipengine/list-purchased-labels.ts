import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"
import {
  purchasedLabelFromApi,
  type ShipEnginePurchasedLabel,
} from "@/lib/shipengine/purchased-label"

export type { ShipEnginePurchasedLabel } from "@/lib/shipengine/purchased-label"
export {
  chargeUsdForPurchasedLabel,
  moneyFromShipEngineAmount,
  purchasedLabelFromApi,
} from "@/lib/shipengine/purchased-label"

const PAGE_SIZE = 200
const MAX_PAGES = 20

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

export type ListPurchasedLabelsResult =
  | {
      ok: true
      labels: ShipEnginePurchasedLabel[]
      total: number
      truncated: boolean
    }
  | { ok: false; error: string; status: number }

/**
 * GET /v1/labels paged across `created_at_start` … `created_at_end` (ISO instants).
 * ShipEngine is the billing source of truth for postage charged to the Reswell account.
 */
export async function listPurchasedShipEngineLabels(params: {
  createdAtStartIso: string
  createdAtEndIso: string
}): Promise<ListPurchasedLabelsResult> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "SHIPENGINE_API_KEY is not configured.", status: 503 }
  }

  const labels: ShipEnginePurchasedLabel[] = []
  let total = 0
  let truncated = false

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const q = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      sort_dir: "desc",
      sort_by: "created_at",
      created_at_start: params.createdAtStartIso,
      created_at_end: params.createdAtEndIso,
    })
    const res = await shipEngineRequest(`/labels?${q.toString()}`)
    const data = await parseJsonSafe(res)
    const apiErr = formatShipEngineApiError(data)
    if (apiErr) {
      return {
        ok: false,
        error: apiErr,
        status: res.ok ? 422 : res.status >= 400 ? res.status : 502,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data === "string" ? data : "Could not list ShipEngine labels.",
        status: res.status >= 400 ? res.status : 502,
      }
    }

    const root = asRecord(data)
    const raw = root?.labels
    if (!Array.isArray(raw)) {
      return { ok: false, error: "Unexpected ShipEngine response (no labels array).", status: 502 }
    }

    const reportedTotal = typeof root?.total === "number" ? root.total : Number(root?.total)
    if (Number.isFinite(reportedTotal)) total = reportedTotal

    for (const item of raw) {
      const row = asRecord(item)
      if (!row) continue
      const parsed = purchasedLabelFromApi(row)
      if (parsed) labels.push(parsed)
    }

    const pages = typeof root?.pages === "number" ? root.pages : Number(root?.pages)
    const doneByPages = Number.isFinite(pages) && page >= pages
    const doneByShortPage = raw.length < PAGE_SIZE
    if (doneByPages || doneByShortPage) {
      if (!Number.isFinite(reportedTotal)) total = labels.length
      return { ok: true, labels, total, truncated: false }
    }
  }

  truncated = true
  if (total < labels.length) total = labels.length
  return { ok: true, labels, total, truncated }
}
