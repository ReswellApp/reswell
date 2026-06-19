import { createServiceRoleClient } from "@/lib/supabase/server"
import type { CreateConsignmentStoreInput } from "@/lib/validations/consignment-store"
import type { ConsignmentStore } from "@/lib/types/consignment"
import { getConsignmentStoreById } from "@/lib/db/consignmentStores"

export type CreateConsignmentStoreResult =
  | { ok: true; store: ConsignmentStore }
  | { ok: false; message: string; status: number }

/**
 * Creates a consignment store. The owner must already hold the consignment-shop role
 * (granted by an admin), and is recorded as the store's first 'owner' staff member.
 */
export async function createConsignmentStore(
  input: CreateConsignmentStoreInput,
): Promise<CreateConsignmentStoreResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error", status: 503 }
  }

  const { data: owner, error: ownerErr } = await supabase
    .from("profiles")
    .select("id, is_consignment_shop")
    .eq("id", input.ownerProfileId)
    .maybeSingle()

  if (ownerErr) {
    console.error("[adminConsignmentStore] owner lookup failed", ownerErr)
    return { ok: false, message: "Could not verify owner", status: 500 }
  }
  if (!owner) {
    return { ok: false, message: "Owner profile not found", status: 404 }
  }
  if (owner.is_consignment_shop !== true) {
    return {
      ok: false,
      message: "Owner must be granted the consignment-shop role before creating a store",
      status: 409,
    }
  }

  const { data: existingSlug } = await supabase
    .from("consignment_stores")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle()

  if (existingSlug?.id) {
    return { ok: false, message: "A store with that slug already exists", status: 409 }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("consignment_stores")
    .insert({
      slug: input.slug,
      name: input.name,
      owner_profile_id: input.ownerProfileId,
      default_commission_bps: input.defaultCommissionBps,
      ...(typeof input.reswellFeeBps === "number" ? { reswell_fee_bps: input.reswellFeeBps } : {}),
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    console.error("[adminConsignmentStore] insert failed", insertErr)
    return { ok: false, message: "Could not create store", status: 500 }
  }

  const { error: staffErr } = await supabase
    .from("consignment_store_staff")
    .insert({ store_id: inserted.id, profile_id: input.ownerProfileId, role: "owner" })

  if (staffErr) {
    console.error("[adminConsignmentStore] owner staff insert failed", staffErr)
    // Store exists; surface a soft error so the admin can retry adding staff rather than orphaning.
    return { ok: false, message: "Store created, but owner staff row failed — retry", status: 500 }
  }

  const store = await getConsignmentStoreById(supabase, inserted.id)
  if (!store) {
    return { ok: false, message: "Store created but could not be loaded", status: 500 }
  }

  return { ok: true, store }
}
