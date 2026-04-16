import type { SupabaseClient } from "@supabase/supabase-js"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"

export type VerifyPickupResult =
  | {
      ok: true
      buyerId: string
      listingId: string
    }
  | { ok: false; error: string; status: number }

const RPC_ERROR_MAP: Record<string, { error: string; status: number }> = {
  unauthorized: { error: "Unauthorized", status: 401 },
  code_required: { error: "Pickup code is required", status: 400 },
  not_found: { error: "Order not found", status: 404 },
  not_pickup: { error: "This order is not a pickup order", status: 400 },
  already_picked_up: { error: "Pickup already confirmed", status: 409 },
  invalid_code: { error: "Invalid pickup code", status: 403 },
}

/**
 * Seller verifies the buyer's pickup code via the `verify_order_pickup_for_seller`
 * SECURITY DEFINER RPC. The authenticated seller's session provides `auth.uid()` to
 * the function, which validates ownership, compares the code, and atomically updates
 * both the order and payout rows in a single transaction.
 */
export async function verifyOrderPickupForSeller(
  supabase: SupabaseClient,
  input: { orderId: string; code: string },
): Promise<VerifyPickupResult> {
  const { orderId, code } = input
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return { ok: false, error: "Pickup code is required", status: 400 }
  }

  const { data, error: rpcErr } = await supabase.rpc(
    "verify_order_pickup_for_seller",
    { p_order_id: orderId, p_code: trimmedCode },
  )

  if (rpcErr) {
    console.error("[verifyOrderPickupForSeller] rpc error", rpcErr)
    return { ok: false, error: "Failed to verify pickup", status: 500 }
  }

  const result = data as { ok: boolean; error?: string; buyer_id?: string; listing_id?: string }

  if (!result.ok) {
    const mapped = RPC_ERROR_MAP[result.error ?? ""] ?? {
      error: "Failed to verify pickup",
      status: 500,
    }
    return { ok: false, ...mapped }
  }

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    console.error("[verifyOrderPickupForSeller] release seller earnings:", release.error)
    return { ok: false, error: release.error, status: 500 }
  }

  return {
    ok: true,
    buyerId: result.buyer_id!,
    listingId: result.listing_id!,
  }
}
