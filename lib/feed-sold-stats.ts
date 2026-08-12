import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

type ConfirmedSaleStatsRpcRow = {
  items_sold: number | string | null
  gmv_total: number | string | null
}

const EMPTY_STATS = { soldCount: 0, gmvTotal: 0 } as const

function parseRpcStats(data: unknown): { soldCount: number; gmvTotal: number } | null {
  const row = Array.isArray(data)
    ? (data[0] as ConfirmedSaleStatsRpcRow | undefined)
    : data != null && typeof data === "object"
      ? (data as ConfirmedSaleStatsRpcRow)
      : undefined
  if (row == null) return null

  const soldCount = Math.max(0, Math.trunc(Number(row.items_sold ?? 0)))
  const rawGmv = row.gmv_total
  const gmvTotalNum =
    typeof rawGmv === "string"
      ? parseFloat(rawGmv)
      : typeof rawGmv === "number"
        ? rawGmv
        : Number(rawGmv ?? 0)

  return {
    soldCount,
    gmvTotal: Number.isFinite(gmvTotalNum) ? gmvTotalNum : 0,
  }
}

/**
 * Public headline stats from confirmed checkout only (Stripe, wallet, POS,
 * admin terminal). List prices and listings marked sold off-platform are excluded.
 */
export async function getSoldFeedStats(
  sections: readonly string[] = PEER_LISTING_SECTIONS_FILTER,
): Promise<{ soldCount: number; gmvTotal: number }> {
  const supabase = createAnonSupabaseClient()
  const useSurfboardsOnly = sections.length === 1 && sections[0] === "surfboards"

  const { data, error } = useSurfboardsOnly
    ? await supabase.rpc("marketplace_surfboard_confirmed_sale_stats")
    : await supabase.rpc("marketplace_listing_confirmed_sale_stats", {
        p_sections: [...sections],
      })

  if (error) {
    console.error(
      `[feed-sold-stats] ${useSurfboardsOnly ? "marketplace_surfboard_confirmed_sale_stats" : "marketplace_listing_confirmed_sale_stats"}`,
      error.message,
    )
    return { ...EMPTY_STATS }
  }

  const parsed = parseRpcStats(data)
  if (parsed == null) {
    console.error("[feed-sold-stats] confirmed-sale stats RPC returned an unexpected payload")
    return { ...EMPTY_STATS }
  }

  return parsed
}
