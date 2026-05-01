import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"

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

function pickUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const u = value.trim()
    return /^https?:\/\//i.test(u) ? u : null
  }
  const r = asRecord(value)
  if (r && typeof r.url === "string" && /^https?:\/\//i.test(r.url.trim())) return r.url.trim()
  const href = r && typeof r.href === "string" ? r.href.trim() : ""
  return /^https?:\/\//i.test(href) ? href : null
}

/** Normalizes `label_download` from GET /labels/{id} (strings or nested url objects). */
export function extractLabelDownloadUrls(label: Record<string, unknown>): {
  href: string | null
  pdf: string | null
  png: string | null
  zpl: string | null
} {
  const ld = asRecord(label.label_download)
  if (!ld) {
    return { href: null, pdf: null, png: null, zpl: null }
  }
  return {
    href: pickUrl(ld.href),
    pdf: pickUrl(ld.pdf),
    png: pickUrl(ld.png),
    zpl: pickUrl(ld.zpl),
  }
}

export type ShipEngineLabelDetail = {
  label_id: string
  shipment_id: string | null
  tracking_number: string | null
  status: string | null
  voided: boolean
  carrier_code: string | null
  downloads: ReturnType<typeof extractLabelDownloadUrls>
}

function normalizeLabelRow(label: Record<string, unknown>): ShipEngineLabelDetail {
  const labelId = typeof label.label_id === "string" ? label.label_id : ""
  const shipmentId =
    typeof label.shipment_id === "string" ? label.shipment_id : null
  const tracking =
    typeof label.tracking_number === "string" ? label.tracking_number.trim() || null : null
  const status = typeof label.status === "string" ? label.status : null
  const voided = label.voided === true
  const carrier =
    typeof label.carrier_code === "string" ? label.carrier_code.trim() || null : null
  return {
    label_id: labelId,
    shipment_id: shipmentId,
    tracking_number: tracking,
    status,
    voided,
    carrier_code: carrier,
    downloads: extractLabelDownloadUrls(label),
  }
}

/** GET /v1/labels?shipment_id=… — returns label rows (may omit full label_download). */
export async function fetchLabelsByShipmentId(shipmentId: string): Promise<
  | { ok: true; labels: ShipEngineLabelDetail[] }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "SHIPENGINE_API_KEY is not configured.", status: 503 }
  }
  const id = shipmentId.trim()
  if (!id || !/^se-[a-zA-Z0-9_-]+$/.test(id)) {
    return { ok: false, error: "Invalid shipment_id (expected format like se-123…).", status: 400 }
  }

  const q = new URLSearchParams({
    shipment_id: id,
    page_size: "10",
    sort_dir: "desc",
    sort_by: "created_at",
  })
  const res = await shipEngineRequest(`/labels?${q.toString()}`)
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : JSON.stringify(data).slice(0, 400),
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const root = asRecord(data)
  const raw = root?.labels
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Unexpected ShipEngine response (no labels array).", status: 502 }
  }

  const labels: ShipEngineLabelDetail[] = []
  for (const item of raw) {
    const row = asRecord(item)
    if (row) labels.push(normalizeLabelRow(row))
  }
  return { ok: true, labels }
}

/** GET /v1/labels/{label_id} — full label including label_download URLs. */
export async function fetchLabelById(labelId: string): Promise<
  | { ok: true; label: ShipEngineLabelDetail }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "SHIPENGINE_API_KEY is not configured.", status: 503 }
  }
  const id = labelId.trim()
  if (!id || !/^se-[a-zA-Z0-9_-]+$/.test(id)) {
    return { ok: false, error: "Invalid label_id (expected format like se-123…).", status: 400 }
  }

  const res = await shipEngineRequest(`/labels/${encodeURIComponent(id)}`)
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : JSON.stringify(data).slice(0, 400),
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const row = asRecord(data)
  if (!row || typeof row.label_id !== "string") {
    return { ok: false, error: "Unexpected ShipEngine label response.", status: 502 }
  }
  return { ok: true, label: normalizeLabelRow(row) }
}

/** List labels for shipment, then load the first label for full download URLs. */
export async function fetchLabelDownloadsForShipment(shipmentId: string): Promise<
  | { ok: true; label: ShipEngineLabelDetail; listCount: number }
  | { ok: false; error: string; status: number }
> {
  const listed = await fetchLabelsByShipmentId(shipmentId)
  if (!listed.ok) return listed
  if (listed.labels.length === 0) {
    return {
      ok: false,
      error:
        "No labels found for this shipment_id. Confirm the ID in ShipEngine or that the label finished processing.",
      status: 404,
    }
  }
  const firstId = listed.labels[0].label_id
  if (!firstId) {
    return { ok: false, error: "ShipEngine returned a label without label_id.", status: 502 }
  }
  const detail = await fetchLabelById(firstId)
  if (!detail.ok) return detail
  return { ok: true, label: detail.label, listCount: listed.labels.length }
}

/** GET /v1/labels?tracking_number=… — newest first (ShipEngine default sort). */
export async function fetchLabelsByTrackingNumber(trackingNumber: string): Promise<
  | { ok: true; labels: ShipEngineLabelDetail[] }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "SHIPENGINE_API_KEY is not configured.", status: 503 }
  }
  const track = trackingNumber.trim()
  if (!track) {
    return { ok: false, error: "Missing tracking number.", status: 400 }
  }

  const q = new URLSearchParams({
    tracking_number: track,
    page_size: "25",
    sort_dir: "desc",
    sort_by: "created_at",
  })
  const res = await shipEngineRequest(`/labels?${q.toString()}`)
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : JSON.stringify(data).slice(0, 400),
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const root = asRecord(data)
  const raw = root?.labels
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Unexpected ShipEngine response (no labels array).", status: 502 }
  }

  const labels: ShipEngineLabelDetail[] = []
  for (const item of raw) {
    const row = asRecord(item)
    if (row) labels.push(normalizeLabelRow(row))
  }
  return { ok: true, labels }
}
