import type { SupabaseClient } from "@supabase/supabase-js"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"

export type VerifyPickupResult =
  | {
      ok: true
      buyerId: string
      listingId: string
    }
  | { ok: false; error: string; status: number }

type RpcPayload = {
  ok?: boolean
  error?: string
  buyer_id?: string
  listing_id?: string
}

function mapRpcError(code: string | undefined): { error: string; status: number } {
  switch (code) {
    case "unauthorized":
      return { error: "Unauthorized", status: 401 }
    case "code_required":
      return { error: "Pickup code is required", status: 400 }
    case "not_found":
      return { error: "Order not found", status: 404 }
    case "not_pickup":
      return { error: "This order is not a pickup order", status: 400 }
    case "already_picked_up":
      return { error: "Pickup already confirmed", status: 409 }
    case "invalid_code":
      return { error: "Invalid pickup code", status: 403 }
    default:
      return { error: "Could not verify pickup", status: 500 }
  }
}

/**
 * Seller verifies the buyer's pickup code via SECURITY DEFINER RPC (`verify_order_pickup_for_seller`).
 * That updates `orders` and `payouts` in Postgres with the caller's JWT (`auth.uid()`), avoiding
 * REST/RLS mismatches. Wallet release still uses `release_order_seller_earnings_to_wallet` (service role).
 */
export async function verifyOrderPickupForSeller(input: {
  supabase: SupabaseClient
  orderId: string
  code: string
}): Promise<VerifyPickupResult> {
  const { supabase, orderId, code } = input

  const { data, error: rpcErr } = await supabase.rpc("verify_order_pickup_for_seller", {
    p_order_id: orderId,
    p_code: code.trim(),
  })

  if (rpcErr) {
    console.error("[verifyOrderPickupForSeller] rpc", rpcErr)
    return { ok: false, error: "Failed to verify pickup", status: 500 }
  }

  const payload = data as RpcPayload | null
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid verify response", status: 500 }
  }

  if (payload.ok !== true) {
    return { ok: false, ...mapRpcError(payload.error) }
  }

  const buyerId = payload.buyer_id
  const listingId = payload.listing_id
  if (!buyerId || !listingId) {
    return { ok: false, error: "Invalid verify response", status: 500 }
  }

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    console.error("[verifyOrderPickupForSeller] release seller earnings:", release.error)
    return { ok: false, error: release.error, status: 500 }
  }

  return { ok: true, buyerId, listingId }
}
