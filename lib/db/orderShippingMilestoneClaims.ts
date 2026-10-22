import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderShippingSmsMilestone } from "@/lib/shipping/order-shipping-sms-milestone"

const MILESTONES: readonly OrderShippingSmsMilestone[] = [
  "out_for_delivery",
  "delivered",
  "exception",
]

function isMilestone(value: unknown): value is OrderShippingSmsMilestone {
  return value === "out_for_delivery" || value === "delivered" || value === "exception"
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate key")
}

/**
 * Milestones already sent for this order.
 * A read failure returns every milestone so a missing table or a blip cannot
 * re-text the buyer list. The next webhook or cron run tries again.
 */
export async function listOrderShippingMilestoneClaims(
  supabase: SupabaseClient,
  orderId: string,
): Promise<Set<OrderShippingSmsMilestone>> {
  const { data, error } = await supabase
    .from("order_shipping_milestone_claims")
    .select("milestone")
    .eq("order_id", orderId)

  if (error) {
    console.error("[orderShippingMilestoneClaims] list:", error.message)
    return new Set(MILESTONES)
  }

  const claimed = new Set<OrderShippingSmsMilestone>()
  for (const row of data ?? []) {
    const milestone = (row as { milestone?: unknown }).milestone
    if (isMilestone(milestone)) claimed.add(milestone)
  }
  return claimed
}

/** Insert-if-absent. Only the winner may send. */
export async function claimOrderShippingMilestone(
  supabase: SupabaseClient,
  orderId: string,
  milestone: OrderShippingSmsMilestone,
): Promise<"claimed" | "taken"> {
  const { error } = await supabase.from("order_shipping_milestone_claims").insert({
    order_id: orderId,
    milestone,
  })

  if (!error) return "claimed"
  if (isUniqueViolation(error)) return "taken"

  console.error("[orderShippingMilestoneClaims] claim:", error.message)
  return "taken"
}

/** Drop a claim when Klaviyo did not accept the event, so a later writer can retry. */
export async function releaseOrderShippingMilestoneClaim(
  supabase: SupabaseClient,
  orderId: string,
  milestone: OrderShippingSmsMilestone,
): Promise<void> {
  const { error } = await supabase
    .from("order_shipping_milestone_claims")
    .delete()
    .eq("order_id", orderId)
    .eq("milestone", milestone)

  if (error) {
    console.error("[orderShippingMilestoneClaims] release:", error.message)
  }
}
