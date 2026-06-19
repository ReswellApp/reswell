import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById } from "@/lib/db/consignmentStores"
import type { ConsignmentStoreStaffRole } from "@/lib/types/consignment"
import type { StoreStaffRole } from "@/lib/validations/consignment"

export type StoreStaffMember = {
  profileId: string
  role: ConsignmentStoreStaffRole
  name: string
  email: string | null
  isOwner: boolean
}

type ServiceFail = { ok: false; error: string; status: number }

/** Owner + staff for a store, with display name/email, owner first. */
export async function listStoreStaff(
  storeId: string,
): Promise<{ ok: true; staff: StoreStaffMember[] } | ServiceFail> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, storeId)
  if (!store) return { ok: false, error: "Store not found", status: 404 }

  const { data: staffRows, error } = await service
    .from("consignment_store_staff")
    .select("profile_id, role")
    .eq("store_id", storeId)

  if (error) {
    console.error("[storeStaff] list failed", { storeId, error })
    return { ok: false, error: "Could not load staff", status: 500 }
  }

  const rows = (staffRows ?? []) as { profile_id: string; role: ConsignmentStoreStaffRole }[]
  const profileIds = [...new Set([store.ownerProfileId, ...rows.map((r) => r.profile_id)])]

  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name, email")
    .in("id", profileIds)

  const profileById = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null; email: string | null }[]).map(
      (p) => [p.id, p],
    ),
  )

  const roleById = new Map(rows.map((r) => [r.profile_id, r.role]))

  const staff: StoreStaffMember[] = profileIds.map((id) => {
    const profile = profileById.get(id)
    const isOwner = id === store.ownerProfileId
    return {
      profileId: id,
      role: isOwner ? "owner" : roleById.get(id) ?? "clerk",
      name: profile?.display_name ?? "Unknown",
      email: profile?.email ?? null,
      isOwner,
    }
  })

  // Owner first, then by name.
  staff.sort((a, b) => (a.isOwner ? -1 : b.isOwner ? 1 : a.name.localeCompare(b.name)))

  return { ok: true, staff }
}

/** Owner-only: add a staff member by their Reswell account email. */
export async function addStoreStaff(input: {
  ownerProfileId: string
  storeId: string
  email: string
  role: StoreStaffRole
}): Promise<{ ok: true } | ServiceFail> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) return { ok: false, error: "Store not found", status: 404 }
  if (store.ownerProfileId !== input.ownerProfileId) {
    return { ok: false, error: "Only the store owner can manage staff.", status: 403 }
  }

  const email = input.email.trim().toLowerCase()
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle()

  if (!profile?.id) {
    return {
      ok: false,
      error: "No Reswell account found with that email. Ask them to sign up first.",
      status: 404,
    }
  }
  if (profile.id === store.ownerProfileId) {
    return { ok: false, error: "The owner is already on the team.", status: 409 }
  }

  const { error } = await service
    .from("consignment_store_staff")
    .upsert(
      { store_id: input.storeId, profile_id: profile.id, role: input.role },
      { onConflict: "store_id,profile_id" },
    )

  if (error) {
    console.error("[storeStaff] add failed", { storeId: input.storeId, error })
    return { ok: false, error: "Could not add staff member", status: 500 }
  }

  return { ok: true }
}

/** Owner-only: remove a staff member (the owner cannot be removed). */
export async function removeStoreStaff(input: {
  ownerProfileId: string
  storeId: string
  profileId: string
}): Promise<{ ok: true } | ServiceFail> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) return { ok: false, error: "Store not found", status: 404 }
  if (store.ownerProfileId !== input.ownerProfileId) {
    return { ok: false, error: "Only the store owner can manage staff.", status: 403 }
  }
  if (input.profileId === store.ownerProfileId) {
    return { ok: false, error: "The store owner cannot be removed.", status: 400 }
  }

  const { error } = await service
    .from("consignment_store_staff")
    .delete()
    .eq("store_id", input.storeId)
    .eq("profile_id", input.profileId)

  if (error) {
    console.error("[storeStaff] remove failed", { storeId: input.storeId, error })
    return { ok: false, error: "Could not remove staff member", status: 500 }
  }

  return { ok: true }
}
