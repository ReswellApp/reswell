import type { SupabaseClient } from "@supabase/supabase-js"

export type BuyerNotifiedDeliveredClaim = "claimed" | "already" | "unavailable"

function isMissingBuyerNotifiedColumn(error: { code?: string; message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase()
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("buyer_notified_delivered_at")
  )
}

/**
 * Stamp `orders.buyer_notified_delivered_at` if it is still null.
 * The winning update is the only one that may text the buyer.
 * `unavailable` means the column is not migrated yet; the caller may still send.
 */
export async function claimBuyerNotifiedDelivered(
  supabase: SupabaseClient,
  orderId: string,
  notifiedAt: Date = new Date(),
): Promise<BuyerNotifiedDeliveredClaim> {
  const { data, error } = await supabase
    .from("orders")
    .update({ buyer_notified_delivered_at: notifiedAt.toISOString() })
    .eq("id", orderId)
    .is("buyer_notified_delivered_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    if (isMissingBuyerNotifiedColumn(error)) return "unavailable"
    console.error("[orderBuyerNotifiedDelivered] claim:", error.message)
    return "already"
  }

  return data ? "claimed" : "already"
}

/** Clear the stamp when Klaviyo did not accept the delivered event. */
export async function releaseBuyerNotifiedDelivered(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ buyer_notified_delivered_at: null })
    .eq("id", orderId)

  if (error && !isMissingBuyerNotifiedColumn(error)) {
    console.error("[orderBuyerNotifiedDelivered] release:", error.message)
  }
}
