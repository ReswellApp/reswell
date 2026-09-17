import type { SupabaseClient } from "@supabase/supabase-js"
import { csAgentOrderIsInScope } from "@/lib/utils/cs-agent-scope"

export type LiveChatActionActor =
  | { role: "staff"; userId: string }
  | { role: "member"; userId: string }
  | { role: "guest" }

export type LiveChatActionOrderParty = {
  id: string
  buyerId: string | null
  sellerId: string | null
  status: string
  deliveryStatus: string | null
}

const BLOCKED_ORDER_STATUSES = new Set(["refunded", "cancelled"])
const BLOCKED_DELIVERY = new Set(["delivered", "picked_up"])

/**
 * Mutations that touch postage / money require a signed-in party on the order
 * (or staff). Guests can only ask — never execute.
 */
export function liveChatActorCanMutateShipping(
  actor: LiveChatActionActor,
  order: LiveChatActionOrderParty,
): { ok: true } | { ok: false; error: string; code: "auth_required" | "forbidden" | "blocked" } {
  if (BLOCKED_ORDER_STATUSES.has(order.status)) {
    return { ok: false, error: "This order can no longer change shipping labels.", code: "blocked" }
  }
  if (order.deliveryStatus && BLOCKED_DELIVERY.has(order.deliveryStatus)) {
    return { ok: false, error: "This order is already delivered.", code: "blocked" }
  }

  if (actor.role === "staff") return { ok: true }

  if (actor.role === "guest") {
    return {
      ok: false,
      error: "Sign in to manage shipping for this order.",
      code: "auth_required",
    }
  }

  const inScope = csAgentOrderIsInScope(
    { id: order.id, buyerId: order.buyerId, sellerId: order.sellerId },
    { linkedOrderId: order.id, requesterUserId: actor.userId },
  )
  if (!inScope) {
    return { ok: false, error: "That order is not on your account.", code: "forbidden" }
  }
  return { ok: true }
}

/** Prompt-injection / scam rails: never let the model invent write tools outside this allowlist. */
export const LIVE_CHAT_WRITE_ACTION_ALLOWLIST = [
  "void_shipping_label",
  "replace_shipping_label",
] as const

export async function resolveLiveChatActionActor(
  supabase: SupabaseClient,
  opts: { visitorUserId?: string | null; staffUserId?: string | null },
): Promise<LiveChatActionActor> {
  if (opts.staffUserId) return { role: "staff", userId: opts.staffUserId }
  if (opts.visitorUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin, is_employee")
      .eq("id", opts.visitorUserId)
      .maybeSingle()
    if (data?.is_admin === true || data?.is_employee === true) {
      return { role: "staff", userId: opts.visitorUserId }
    }
    return { role: "member", userId: opts.visitorUserId }
  }
  return { role: "guest" }
}
