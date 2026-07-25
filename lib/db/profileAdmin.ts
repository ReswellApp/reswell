import type { SupabaseClient } from "@supabase/supabase-js"

/** Whether `profiles.is_admin` is true for the given user. */
export async function fetchProfileIsAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true
}
