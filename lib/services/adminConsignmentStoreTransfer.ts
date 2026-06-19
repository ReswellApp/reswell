import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById } from "@/lib/db/consignmentStores"

export type TransferConsignmentStoreOwnerResult =
  | { ok: true }
  | { ok: false; message: string; status: number }

/**
 * Reassign store ownership to a profile that already holds is_consignment_shop.
 * Updates staff rows and re-points active consigned listings to the new shop seller.
 */
export async function transferConsignmentStoreOwner(input: {
  storeId: string
  newOwnerProfileId: string
}): Promise<TransferConsignmentStoreOwnerResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(supabase, input.storeId)
  if (!store) {
    return { ok: false, message: "Store not found", status: 404 }
  }

  if (store.ownerProfileId === input.newOwnerProfileId) {
    return { ok: true }
  }

  const { data: newOwner, error: ownerErr } = await supabase
    .from("profiles")
    .select("id, is_consignment_shop")
    .eq("id", input.newOwnerProfileId)
    .maybeSingle()

  if (ownerErr) {
    console.error("[adminConsignmentStoreTransfer] owner lookup failed", ownerErr)
    return { ok: false, message: "Could not verify new owner", status: 500 }
  }
  if (!newOwner) {
    return { ok: false, message: "New owner profile not found", status: 404 }
  }
  if (newOwner.is_consignment_shop !== true) {
    return {
      ok: false,
      message: "Grant the consignment-shop role to this user before assigning ownership",
      status: 409,
    }
  }

  const previousOwnerId = store.ownerProfileId

  const { error: storeErr } = await supabase
    .from("consignment_stores")
    .update({
      owner_profile_id: input.newOwnerProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.storeId)

  if (storeErr) {
    console.error("[adminConsignmentStoreTransfer] store update failed", storeErr)
    return { ok: false, message: "Could not transfer store ownership", status: 500 }
  }

  const { error: staffUpsertErr } = await supabase.from("consignment_store_staff").upsert(
    {
      store_id: input.storeId,
      profile_id: input.newOwnerProfileId,
      role: "owner",
    },
    { onConflict: "store_id,profile_id" },
  )

  if (staffUpsertErr) {
    console.error("[adminConsignmentStoreTransfer] staff upsert failed", staffUpsertErr)
    return { ok: false, message: "Store owner updated, but staff row failed", status: 500 }
  }

  if (previousOwnerId !== input.newOwnerProfileId) {
    await supabase
      .from("consignment_store_staff")
      .delete()
      .eq("store_id", input.storeId)
      .eq("profile_id", previousOwnerId)
  }

  const { error: listingsErr } = await supabase
    .from("listings")
    .update({
      user_id: input.newOwnerProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("consignment_store_id", input.storeId)

  if (listingsErr) {
    console.error("[adminConsignmentStoreTransfer] listings update failed", listingsErr)
    return {
      ok: false,
      message: "Ownership transferred, but consigned listings could not be re-pointed",
      status: 500,
    }
  }

  return { ok: true }
}
