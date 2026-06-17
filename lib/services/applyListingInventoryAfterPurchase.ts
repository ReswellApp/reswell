import type { SupabaseClient } from "@supabase/supabase-js"

export type ApplyListingInventoryResult =
  | {
      ok: true
      action: "sold" | "decremented" | "depleted"
      stockQuantity?: number
      status?: string
    }
  | { ok: false; error: string }

type RpcPayload = {
  ok?: boolean
  error?: string
  action?: string
  stock_quantity?: number
  status?: string
}

/**
 * After a successful order line: decrement sync_managed stock or mark a unique P2P listing sold.
 * Uses a Postgres RPC with row lock to avoid overselling under concurrent checkout.
 */
export async function applyListingInventoryAfterPurchase(
  supabase: SupabaseClient,
  listingId: string,
  quantity = 1,
): Promise<ApplyListingInventoryResult> {
  const { data, error } = await supabase.rpc("decrement_listing_stock_after_purchase", {
    p_listing_id: listingId,
    p_quantity: quantity,
  })

  if (error) {
    console.error("[listing-inventory] rpc failed", { listingId, error: error.message })
    return { ok: false, error: error.message }
  }

  const payload = (data ?? {}) as RpcPayload
  if (!payload.ok) {
    return { ok: false, error: payload.error ?? "inventory_update_failed" }
  }

  const action = payload.action
  if (action === "sold" || action === "decremented" || action === "depleted") {
    return {
      ok: true,
      action,
      stockQuantity:
        typeof payload.stock_quantity === "number" ? payload.stock_quantity : undefined,
      status: typeof payload.status === "string" ? payload.status : undefined,
    }
  }

  return { ok: false, error: "unexpected_inventory_action" }
}

export async function applyListingInventoryAfterPurchaseBatch(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; listingId?: string }> {
  for (const listingId of listingIds) {
    const result = await applyListingInventoryAfterPurchase(supabase, listingId, 1)
    if (!result.ok) {
      return { ok: false, error: result.error, listingId }
    }
  }
  return { ok: true }
}
