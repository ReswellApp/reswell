import { createServiceRoleClient } from "@/lib/supabase/server"
import type { ConsignmentStoreStatus } from "@/lib/types/consignment"

export type AdminConsignmentStoreRow = {
  id: string
  slug: string
  name: string
  status: ConsignmentStoreStatus
  defaultCommissionBps: number
  ownerProfileId: string
  ownerEmail: string | null
  ownerDisplayName: string | null
  ownerIsConsignmentShop: boolean
  staffCount: number
  createdAt: string
}

export async function listAdminConsignmentStores(): Promise<
  { ok: true; stores: AdminConsignmentStoreRow[] } | { ok: false; message: string }
> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error" }
  }

  const { data: storeRows, error: storeErr } = await supabase
    .from("consignment_stores")
    .select(
      "id, slug, name, status, default_commission_bps, owner_profile_id, created_at",
    )
    .order("created_at", { ascending: false })

  if (storeErr) {
    console.error("[adminConsignmentStoresList] stores failed", storeErr)
    return { ok: false, message: "Could not load consignment stores" }
  }

  const ownerIds = [...new Set((storeRows ?? []).map((r) => r.owner_profile_id))]
  const { data: owners, error: ownersErr } = ownerIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name, is_consignment_shop")
        .in("id", ownerIds)
    : { data: [], error: null }

  if (ownersErr) {
    console.error("[adminConsignmentStoresList] owners failed", ownersErr)
    return { ok: false, message: "Could not load store owners" }
  }

  const ownerById = new Map(
    (owners ?? []).map((o) => [
      o.id,
      {
        email: o.email as string | null,
        displayName: o.display_name as string | null,
        isConsignmentShop: o.is_consignment_shop === true,
      },
    ]),
  )

  const storeIds = (storeRows ?? []).map((r) => r.id)
  const { data: staffRows, error: staffErr } = storeIds.length
    ? await supabase.from("consignment_store_staff").select("store_id").in("store_id", storeIds)
    : { data: [], error: null }

  if (staffErr) {
    console.error("[adminConsignmentStoresList] staff count failed", staffErr)
    return { ok: false, message: "Could not load store staff" }
  }

  const staffCountByStore = new Map<string, number>()
  for (const row of staffRows ?? []) {
    staffCountByStore.set(row.store_id, (staffCountByStore.get(row.store_id) ?? 0) + 1)
  }

  const stores: AdminConsignmentStoreRow[] = (storeRows ?? []).map((row) => {
    const owner = ownerById.get(row.owner_profile_id)
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status as ConsignmentStoreStatus,
      defaultCommissionBps: row.default_commission_bps,
      ownerProfileId: row.owner_profile_id,
      ownerEmail: owner?.email ?? null,
      ownerDisplayName: owner?.displayName ?? null,
      ownerIsConsignmentShop: owner?.isConsignmentShop ?? false,
      staffCount: staffCountByStore.get(row.id) ?? 0,
      createdAt: row.created_at,
    }
  })

  return { ok: true, stores }
}

export type AdminConsignmentShopOperatorRow = {
  profileId: string
  email: string | null
  displayName: string | null
  ownedStoreId: string | null
  ownedStoreName: string | null
  ownedStoreSlug: string | null
}

/** Granted consignment-shop operators — with optional owned store (one store per owner typical). */
export async function listConsignmentShopOperatorsForAdmin(): Promise<
  { ok: true; operators: AdminConsignmentShopOperatorRow[] } | { ok: false; message: string }
> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error" }
  }

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("is_consignment_shop", true)
    .order("display_name", { ascending: true })

  if (profilesErr) {
    console.error("[adminConsignmentStoresList] operators failed", profilesErr)
    return { ok: false, message: "Could not load consignment-shop operators" }
  }

  const profileIds = (profiles ?? []).map((p) => p.id)
  const { data: ownedStores, error: storesErr } = profileIds.length
    ? await supabase
        .from("consignment_stores")
        .select("id, slug, name, owner_profile_id")
        .in("owner_profile_id", profileIds)
    : { data: [], error: null }

  if (storesErr) {
    console.error("[adminConsignmentStoresList] operator stores failed", storesErr)
    return { ok: false, message: "Could not load operator stores" }
  }

  const storeByOwner = new Map(
    (ownedStores ?? []).map((s) => [
      s.owner_profile_id,
      { id: s.id, slug: s.slug, name: s.name },
    ]),
  )

  const operators: AdminConsignmentShopOperatorRow[] = (profiles ?? []).map((p) => {
    const owned = storeByOwner.get(p.id)
    return {
      profileId: p.id,
      email: p.email as string | null,
      displayName: p.display_name as string | null,
      ownedStoreId: owned?.id ?? null,
      ownedStoreName: owned?.name ?? null,
      ownedStoreSlug: owned?.slug ?? null,
    }
  })

  return { ok: true, operators }
}
