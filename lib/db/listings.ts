import type { SupabaseClient } from "@supabase/supabase-js"

export async function updateListingHiddenFromSite(
  client: SupabaseClient,
  listingId: string,
  hiddenFromSite: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("listings")
    .update({ hidden_from_site: hiddenFromSite })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}
