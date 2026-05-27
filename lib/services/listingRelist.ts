import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"

/**
 * Re-activate a listing after a full refund.
 * Only transitions from `sold` → `active`; archived/removed listings are left as-is.
 */
export async function relistAfterRefund(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("status", "sold")

  if (error) {
    console.error("[relist] failed to reactivate listing after refund", {
      listingId,
      error,
    })
    return
  }

  revalidateBoardsBrowseCatalog()

  void syncListingToGoogleMerchantBestEffort(supabase, listingId)
}
