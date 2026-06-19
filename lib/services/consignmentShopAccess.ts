import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listStoresForStaffMember,
  type StaffStoreMembership,
} from "@/lib/db/consignmentStores"

export type ConsignmentShopOperatorContext = {
  stores: StaffStoreMembership[]
  primaryStore: StaffStoreMembership | null
}

/** Whether this profile was granted the consignment-shop operator role by an admin. */
export async function profileHasConsignmentShopRole(
  supabase: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_consignment_shop")
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    console.error("[consignmentShopAccess] profile lookup failed", error)
    return false
  }

  return data?.is_consignment_shop === true
}

/**
 * Store memberships for the personal dashboard / shop hub — only when the user holds the
 * consignment-shop role. Staff rows alone (e.g. test data on an admin account) are ignored.
 */
export async function getConsignmentShopOperatorContext(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ConsignmentShopOperatorContext | null> {
  const granted = await profileHasConsignmentShopRole(supabase, profileId)
  if (!granted) {
    return null
  }

  const stores = await listStoresForStaffMember(supabase, profileId)
  return {
    stores,
    primaryStore: stores[0] ?? null,
  }
}
