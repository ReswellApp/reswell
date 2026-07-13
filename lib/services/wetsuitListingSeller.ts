import type { SupabaseClient } from "@supabase/supabase-js"

export async function actorCanManageWetsuitListings(
  supabase: SupabaseClient,
  actorUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", actorUserId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true
}
