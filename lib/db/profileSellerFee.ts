import { createServiceRoleClient } from "@/lib/supabase/server"

/** True when marketplace fee is waived for this seller (internal program; not exposed on profiles). */
export async function fetchSellerFeeWaived(sellerId: string): Promise<boolean> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[profileSellerFee] service client unavailable", e)
    return false
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("is_reswell_seller")
    .eq("id", sellerId)
    .maybeSingle()

  if (error) {
    console.error("[profileSellerFee] fetchSellerFeeWaived failed", { sellerId, error })
    return false
  }

  return data?.is_reswell_seller === true
}
