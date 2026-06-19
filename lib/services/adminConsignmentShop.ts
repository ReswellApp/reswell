import { createServiceRoleClient } from "@/lib/supabase/server"

/** Profile ids currently granted the consignment-shop role. */
export async function listConsignmentShopProfileIds(): Promise<
  { ok: true; profileIds: string[] } | { ok: false; message: string }
> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error" }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_consignment_shop", true)

  if (error) {
    console.error("[adminConsignmentShop] list failed", error)
    return { ok: false, message: "Could not load consignment-shop status" }
  }

  return { ok: true, profileIds: (data ?? []).map((row) => row.id) }
}

/**
 * Grants/revokes the consignment-shop role on a profile. Admin-authorized in the route; the DB
 * guard trigger additionally restricts the flag to admin/service-role writers. Revoking the role
 * does not delete any existing store — surface that in the admin UI before revoking.
 */
export async function setConsignmentShopForUser(
  userId: string,
  grant: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server configuration error" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    console.error("[adminConsignmentShop] profile lookup failed", { userId, profileError })
    return { ok: false, message: "Could not update user" }
  }

  if (!profile) {
    return { ok: false, message: "User not found" }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_consignment_shop: grant })
    .eq("id", userId)

  if (updateError) {
    console.error("[adminConsignmentShop] update failed", { userId, grant, updateError })
    return { ok: false, message: "Could not update user" }
  }

  return { ok: true }
}
