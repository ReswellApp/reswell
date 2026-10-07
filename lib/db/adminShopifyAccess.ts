import type { SupabaseClient } from "@supabase/supabase-js"

export async function dbSetShopifyAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  grant: boolean,
): Promise<"updated" | "not_found"> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ shopify_connect_enabled: grant })
    .eq("id", userId)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? "updated" : "not_found"
}
