import type { SupabaseClient } from "@supabase/supabase-js"

export interface SellerEarningsDashboardTotals {
  lifetimeSoldUsd: number
  earnedLast30dUsd: number
  earnedLast90dUsd: number
  earnedLast365dUsd: number
}

type RpcRow = {
  lifetime_sold_usd: string | number | null
  earned_last_30d_usd: string | number | null
  earned_last_90d_usd: string | number | null
  earned_last_365d_usd: string | number | null
}

function toUsd(n: string | number | null | undefined): number {
  const v = typeof n === "string" ? parseFloat(n) : Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * Aggregates the signed-in user's marketplace seller earnings from `orders`
 * (excludes fully refunded orders). Requires RPC `get_my_seller_earnings_totals`.
 */
export async function getMySellerEarningsTotals(
  supabase: SupabaseClient,
): Promise<SellerEarningsDashboardTotals | null> {
  const { data, error } = await supabase.rpc("get_my_seller_earnings_totals")
  if (error) {
    console.error("[getMySellerEarningsTotals] rpc", error.message)
    return null
  }
  const raw = Array.isArray(data) ? data[0] : data
  if (!raw || typeof raw !== "object") {
    return {
      lifetimeSoldUsd: 0,
      earnedLast30dUsd: 0,
      earnedLast90dUsd: 0,
      earnedLast365dUsd: 0,
    }
  }
  const row = raw as RpcRow
  return {
    lifetimeSoldUsd: toUsd(row.lifetime_sold_usd),
    earnedLast30dUsd: toUsd(row.earned_last_30d_usd),
    earnedLast90dUsd: toUsd(row.earned_last_90d_usd),
    earnedLast365dUsd: toUsd(row.earned_last_365d_usd),
  }
}
