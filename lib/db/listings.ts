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

export async function updateListingCategoryRow(
  client: SupabaseClient,
  listingId: string,
  patch: { category_id: string; board_type?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row: {
    category_id: string
    updated_at: string
    board_type?: string | null
  } = {
    category_id: patch.category_id,
    updated_at: new Date().toISOString(),
  }
  if (patch.board_type !== undefined) {
    row.board_type = patch.board_type
  }

  const { data, error } = await client
    .from("listings")
    .update(row)
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
