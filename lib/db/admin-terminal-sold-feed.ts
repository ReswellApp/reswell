import type { SupabaseClient } from "@supabase/supabase-js"

/** Listing ids with a confirmed admin-terminal checkout (in-store sale). */
export async function fetchAdminTerminalSoldListingIds(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from("orders")
    .select("listing_id")
    .in("listing_id", [...listingIds])
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .eq("sales_channel", "admin_terminal")

  if (error) {
    console.error("[fetchAdminTerminalSoldListingIds]", error.message)
    return new Set()
  }

  return new Set(
    (data ?? [])
      .map((row) => (row as { listing_id?: string | null }).listing_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )
}
