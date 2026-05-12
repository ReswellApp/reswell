import { createClient } from "@supabase/supabase-js"

const MARKETPLACE_SECTIONS = ["surfboards"] as const

type ConfirmedSurfboardSaleStatsRpcRow = {
  items_sold: number | string | null
  gmv_total: number | string | null
}

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return createClient(url, key)
}

function parseRpcStatsRow(rows: ConfirmedSurfboardSaleStatsRpcRow[] | null): {
  soldCount: number
  gmvTotal: number
} {
  const row = rows?.[0]
  const soldCount = Math.max(0, Math.trunc(Number(row?.items_sold ?? 0)))
  const rawGmv = row?.gmv_total
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

/** Public headline stats: surfboards from confirmed Stripe / wallet checkout only. */
export async function getSoldFeedStats(): Promise<{ soldCount: number; gmvTotal: number }> {
  const supabase = anonSupabase()

  const { data, error } = await supabase.rpc("marketplace_surfboard_confirmed_sale_stats")

  if (!error && data != null && Array.isArray(data) && data.length > 0) {
    return parseRpcStatsRow(data as ConfirmedSurfboardSaleStatsRpcRow[])
  }

  if (error) {
    console.error("[feed-sold-stats] marketplace_surfboard_confirmed_sale_stats", error.message)
  } else if (process.env.NODE_ENV === "development") {
    console.warn(
      "[feed-sold-stats] RPC returned empty — migrations may need `marketplace_surfboard_confirmed_sale_stats`; using legacy listings fallback.",
    )
  }

  return getSoldFeedStatsLegacyListingsFallback(supabase)
}

/** Fallback when migrations are not applied (counts `listings.status = sold`). */
async function getSoldFeedStatsLegacyListingsFallback(
  supabase: ReturnType<typeof anonSupabase>,
): Promise<{ soldCount: number; gmvTotal: number }> {
  const pageSize = 1000
  let offset = 0
  let total = 0

  async function sumSoldPricesPaged(): Promise<number> {
    let sum = 0
    offset = 0
    for (;;) {
      const { data, error } = await supabase
        .from("listings")
        .select("price")
        .eq("status", "sold")
        .eq("hidden_from_site", false)
        .in("section", [...MARKETPLACE_SECTIONS])
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) {
        console.error("[feed-sold-stats] sum page", error)
        break
      }
      const rows = data ?? []
      for (const row of rows) {
        sum += Number((row as { price?: unknown }).price) || 0
      }
      if (rows.length < pageSize) break
      offset += pageSize
    }
    return sum
  }

  const { count, error: countError } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "sold")
    .eq("hidden_from_site", false)
    .in("section", [...MARKETPLACE_SECTIONS])

  if (countError) {
    console.error("[feed-sold-stats] count", countError)
  }

  const gmvTotal = await sumSoldPricesPaged()

  return {
    soldCount: count ?? 0,
    gmvTotal,
  }
}
