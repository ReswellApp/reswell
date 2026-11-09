import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { rpcAwardReswellCredit } from "@/lib/db/reswellCredit"
import {
  computeBuyerCreditEarnCents,
  computeSellerCreditEarnCents,
  creditCentsToUsd,
} from "@/lib/reswell-credit-rates"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Award Reswell Credit for a completed purchase (buyer).
 * Admin pilot: only awards when the buyer is `profiles.is_admin`.
 * Idempotent on order id.
 */
export async function maybeAwardBuyerReswellCredit(params: {
  buyerId: string | null | undefined
  orderId: string
  itemSubtotalUsd: number
  supabase?: SupabaseClient
}): Promise<{ awarded: boolean; amountCents: number; reason?: string }> {
  const buyerId = params.buyerId?.trim()
  if (!buyerId) return { awarded: false, amountCents: 0, reason: "no_buyer" }

  const amountCents = computeBuyerCreditEarnCents(params.itemSubtotalUsd)
  if (amountCents <= 0) return { awarded: false, amountCents: 0, reason: "zero" }

  let supabase = params.supabase
  if (!supabase) {
    try {
      supabase = createServiceRoleClient()
    } catch (e) {
      console.error("[reswell-credit] award buyer service client", e)
      return { awarded: false, amountCents: 0, reason: "config" }
    }
  }

  const isAdmin = await fetchProfileIsAdmin(supabase, buyerId)
  if (!isAdmin) return { awarded: false, amountCents: 0, reason: "not_pilot" }

  try {
    const result = await rpcAwardReswellCredit(supabase, {
      userId: buyerId,
      amountCents,
      description: `Earned Reswell Credit from purchase ($${creditCentsToUsd(amountCents).toFixed(2)})`,
      referenceType: "order_buyer_earn",
      referenceId: params.orderId,
      type: "earn",
    })
    return { awarded: result.ok && !result.replayed, amountCents: result.amount_cents ?? amountCents }
  } catch (e) {
    console.error("[reswell-credit] award buyer", e)
    return { awarded: false, amountCents: 0, reason: "rpc_error" }
  }
}

/**
 * Award Reswell Credit when seller earnings release to Reswell Bucks.
 * Admin pilot: only awards when the seller is `profiles.is_admin`.
 * Idempotent on order id.
 */
export async function maybeAwardSellerReswellCredit(params: {
  sellerId: string | null | undefined
  orderId: string
  sellerEarningsUsd: number
  supabase?: SupabaseClient
}): Promise<{ awarded: boolean; amountCents: number; reason?: string }> {
  const sellerId = params.sellerId?.trim()
  if (!sellerId) return { awarded: false, amountCents: 0, reason: "no_seller" }

  const amountCents = computeSellerCreditEarnCents(params.sellerEarningsUsd)
  if (amountCents <= 0) return { awarded: false, amountCents: 0, reason: "zero" }

  let supabase = params.supabase
  if (!supabase) {
    try {
      supabase = createServiceRoleClient()
    } catch (e) {
      console.error("[reswell-credit] award seller service client", e)
      return { awarded: false, amountCents: 0, reason: "config" }
    }
  }

  const isAdmin = await fetchProfileIsAdmin(supabase, sellerId)
  if (!isAdmin) return { awarded: false, amountCents: 0, reason: "not_pilot" }

  try {
    const result = await rpcAwardReswellCredit(supabase, {
      userId: sellerId,
      amountCents,
      description: `Earned Reswell Credit from sale ($${creditCentsToUsd(amountCents).toFixed(2)})`,
      referenceType: "order_seller_earn",
      referenceId: params.orderId,
      type: "earn",
    })
    return { awarded: result.ok && !result.replayed, amountCents: result.amount_cents ?? amountCents }
  } catch (e) {
    console.error("[reswell-credit] award seller", e)
    return { awarded: false, amountCents: 0, reason: "rpc_error" }
  }
}

/** Admin self-serve pilot seed on /earnings (never cashable). Idempotent per day key optional via caller. */
export async function grantAdminPilotReswellCredit(params: {
  supabase: SupabaseClient
  userId: string
  amountCents: number
  referenceId: string
  description?: string
}): Promise<{ ok: true; amountCents: number; balanceCents: number } | { ok: false; error: string }> {
  const isAdmin = await fetchProfileIsAdmin(params.supabase, params.userId)
  if (!isAdmin) return { ok: false, error: "Reswell Credit pilot is limited to Reswell admins." }
  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0 || params.amountCents > 50_000) {
    return { ok: false, error: "Invalid grant amount." }
  }

  try {
    const service = createServiceRoleClient()
    const result = await rpcAwardReswellCredit(service, {
      userId: params.userId,
      amountCents: Math.trunc(params.amountCents),
      description: params.description ?? "Admin pilot Reswell Credit grant",
      referenceType: "admin_pilot_grant",
      referenceId: params.referenceId,
      type: "grant",
    })
    return {
      ok: true,
      amountCents: result.amount_cents ?? params.amountCents,
      balanceCents: result.balance_cents ?? 0,
    }
  } catch (e) {
    console.error("[reswell-credit] grant", e)
    return { ok: false, error: "Could not grant Reswell Credit." }
  }
}
