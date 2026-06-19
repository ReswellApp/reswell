import { randomBytes } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById } from "@/lib/db/consignmentStores"

/**
 * Returns the store's intake QR token, generating + persisting one on first use. The token is baked
 * into the QR a shop prints; the consign page requires it, so only people who scan the official QR
 * (or have the link) can drop a board into that store. Re-runnable and idempotent.
 */
export async function ensureStoreIntakeToken(
  storeId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string; status: number }> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data: existing, error } = await service
    .from("consignment_stores")
    .select("intake_qr_token")
    .eq("id", storeId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: "Could not load store", status: 500 }
  }

  const current = (existing as { intake_qr_token?: string | null } | null)?.intake_qr_token?.trim()
  if (current) {
    return { ok: true, token: current }
  }

  const token = randomBytes(16).toString("hex")
  const { error: updErr } = await service
    .from("consignment_stores")
    .update({ intake_qr_token: token, updated_at: new Date().toISOString() })
    .eq("id", storeId)

  if (updErr) {
    return { ok: false, error: "Could not generate intake token", status: 500 }
  }

  return { ok: true, token }
}

/**
 * Owner-only: turn QR-gated intake on/off. Enabling first ensures a token exists so the printed QR
 * works. Disabling reopens the bare /consign URL. Returns the resulting gate state.
 */
export async function setStoreIntakeGate(
  ownerProfileId: string,
  storeId: string,
  requireToken: boolean,
): Promise<{ ok: true; requireIntakeToken: boolean } | { ok: false; error: string; status: number }> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, storeId)
  if (!store) {
    return { ok: false, error: "Store not found", status: 404 }
  }
  if (store.ownerProfileId !== ownerProfileId) {
    return { ok: false, error: "Only the store owner can change intake settings.", status: 403 }
  }

  if (requireToken) {
    const tokenResult = await ensureStoreIntakeToken(storeId)
    if (!tokenResult.ok) return tokenResult
  }

  const { error } = await service
    .from("consignment_stores")
    .update({ require_intake_token: requireToken, updated_at: new Date().toISOString() })
    .eq("id", storeId)

  if (error) {
    return { ok: false, error: "Could not update intake settings", status: 500 }
  }

  return { ok: true, requireIntakeToken: requireToken }
}
