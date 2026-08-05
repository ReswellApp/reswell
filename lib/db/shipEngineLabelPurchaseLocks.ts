import type { SupabaseClient } from "@supabase/supabase-js"

export type ShipEngineLabelPurchaseLockStatus = "pending" | "purchased" | "failed"

export type ShipEngineLabelPurchaseLockRow = {
  order_id: string
  owner_key: string
  status: ShipEngineLabelPurchaseLockStatus
  shipengine_rate_id: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  label_pdf_url: string | null
  created_at: string
  updated_at: string
}

function asLockRow(data: unknown): ShipEngineLabelPurchaseLockRow | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null
  const r = data as Record<string, unknown>
  const orderId = typeof r.order_id === "string" ? r.order_id : null
  const ownerKey = typeof r.owner_key === "string" ? r.owner_key : null
  const status = r.status
  if (!orderId || !ownerKey) return null
  if (status !== "pending" && status !== "purchased" && status !== "failed") return null
  return {
    order_id: orderId,
    owner_key: ownerKey,
    status,
    shipengine_rate_id: typeof r.shipengine_rate_id === "string" ? r.shipengine_rate_id : null,
    tracking_number: typeof r.tracking_number === "string" ? r.tracking_number : null,
    tracking_carrier: typeof r.tracking_carrier === "string" ? r.tracking_carrier : null,
    label_pdf_url: typeof r.label_pdf_url === "string" ? r.label_pdf_url : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
  }
}

export async function getShipEngineLabelPurchaseLock(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ShipEngineLabelPurchaseLockRow | null> {
  const { data, error } = await supabase
    .from("shipengine_label_purchase_locks")
    .select(
      "order_id, owner_key, status, shipengine_rate_id, tracking_number, tracking_carrier, label_pdf_url, created_at, updated_at",
    )
    .eq("order_id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] get:", error.message)
    return null
  }
  return asLockRow(data)
}

export async function insertShipEngineLabelPurchaseLock(params: {
  supabase: SupabaseClient
  orderId: string
  ownerKey: string
  rateId: string | null
}): Promise<
  | { ok: true; inserted: true }
  | { ok: true; inserted: false }
  | { ok: false; error: string }
> {
  const now = new Date().toISOString()
  const { error } = await params.supabase.from("shipengine_label_purchase_locks").insert({
    order_id: params.orderId,
    owner_key: params.ownerKey,
    status: "pending",
    shipengine_rate_id: params.rateId,
    tracking_number: null,
    tracking_carrier: null,
    label_pdf_url: null,
    created_at: now,
    updated_at: now,
  })

  if (!error) return { ok: true, inserted: true }

  if (error.code === "23505") {
    return { ok: true, inserted: false }
  }

  console.error("[shipEngineLabelPurchaseLocks] insert:", error.message)
  return { ok: false, error: error.message || "Could not acquire label purchase lock" }
}

/** Reclaim a failed lock so a retry can purchase (never reclaim purchased). */
export async function reclaimFailedShipEngineLabelPurchaseLock(params: {
  supabase: SupabaseClient
  orderId: string
  ownerKey: string
  rateId: string | null
}): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await params.supabase
    .from("shipengine_label_purchase_locks")
    .update({
      owner_key: params.ownerKey,
      status: "pending",
      shipengine_rate_id: params.rateId,
      tracking_number: null,
      tracking_carrier: null,
      label_pdf_url: null,
      updated_at: now,
    })
    .eq("order_id", params.orderId)
    .eq("status", "failed")
    .select("order_id")
    .maybeSingle()

  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] reclaim failed:", error.message)
    return false
  }
  return Boolean(data)
}

export async function markShipEngineLabelPurchaseLockPurchased(params: {
  supabase: SupabaseClient
  orderId: string
  ownerKey: string
  rateId: string | null
  trackingNumber: string
  trackingCarrier: string | null
  labelPdfUrl: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { data, error } = await params.supabase
    .from("shipengine_label_purchase_locks")
    .update({
      status: "purchased",
      shipengine_rate_id: params.rateId,
      tracking_number: params.trackingNumber,
      tracking_carrier: params.trackingCarrier,
      label_pdf_url: params.labelPdfUrl,
      updated_at: now,
    })
    .eq("order_id", params.orderId)
    .eq("owner_key", params.ownerKey)
    .eq("status", "pending")
    .select("order_id")
    .maybeSingle()

  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] mark purchased:", error.message)
    return { ok: false, error: error.message || "Could not finalize label purchase lock" }
  }
  if (!data) {
    return { ok: false, error: "Label purchase lock was lost before completion" }
  }
  return { ok: true }
}

export async function markShipEngineLabelPurchaseLockFailed(params: {
  supabase: SupabaseClient
  orderId: string
  ownerKey: string
}): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await params.supabase
    .from("shipengine_label_purchase_locks")
    .update({
      status: "failed",
      updated_at: now,
    })
    .eq("order_id", params.orderId)
    .eq("owner_key", params.ownerKey)
    .eq("status", "pending")

  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] mark failed:", error.message)
  }
}

/** Sync lock to purchased when another path already saved tracking on the order. */
export async function syncShipEngineLabelPurchaseLockFromExisting(params: {
  supabase: SupabaseClient
  orderId: string
  trackingNumber: string
  trackingCarrier: string | null
  labelPdfUrl: string | null
  rateId: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await params.supabase.from("shipengine_label_purchase_locks").upsert(
    {
      order_id: params.orderId,
      owner_key: "synced_existing",
      status: "purchased",
      shipengine_rate_id: params.rateId,
      tracking_number: params.trackingNumber,
      tracking_carrier: params.trackingCarrier,
      label_pdf_url: params.labelPdfUrl,
      updated_at: now,
      created_at: now,
    },
    { onConflict: "order_id" },
  )
  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] sync existing:", error.message)
  }
}

/**
 * Clears the one-label-per-order lock so an admin can buy a replacement after voiding.
 * Only call from the admin exact-parcel replace flow after the prior label has been voided
 * (or best-effort void attempted) and order tracking cleared.
 */
export async function deleteShipEngineLabelPurchaseLockForReplacement(params: {
  supabase: SupabaseClient
  orderId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await params.supabase
    .from("shipengine_label_purchase_locks")
    .delete()
    .eq("order_id", params.orderId)

  if (error) {
    console.error("[shipEngineLabelPurchaseLocks] delete for replacement:", error.message)
    return { ok: false, error: error.message || "Could not reset label purchase lock" }
  }
  return { ok: true }
}
