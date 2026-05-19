import { createServiceRoleClient } from "@/lib/supabase/server"

export async function listReswellSellerProfileIds(): Promise<
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
    .eq("is_reswell_seller", true)

  if (error) {
    console.error("[adminReswellSeller] list failed", error)
    return { ok: false, message: "Could not load Reswell Seller status" }
  }

  return { ok: true, profileIds: (data ?? []).map((row) => row.id) }
}

export async function setReswellSellerForUser(
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
    console.error("[adminReswellSeller] profile lookup failed", { userId, profileError })
    return { ok: false, message: "Could not update user" }
  }

  if (!profile) {
    return { ok: false, message: "User not found" }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_reswell_seller: grant })
    .eq("id", userId)

  if (updateError) {
    console.error("[adminReswellSeller] update failed", { userId, grant, updateError })
    return { ok: false, message: "Could not update user" }
  }

  return { ok: true }
}
