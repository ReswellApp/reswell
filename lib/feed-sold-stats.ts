import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"

const MARKETPLACE_SECTIONS = ["surfboards"] as const

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return createClient(url, key)
}

/** GMV sum — PostgREST aggregate is disabled on this project; sum in pages. */
async function sumSoldPricesPaged(supabase: ReturnType<typeof anonSupabase>): Promise<number> {
  const pageSize = 1000
  let offset = 0
  let total = 0
  for (;;) {
    const { data, error } = await supabase
      .from("listings")
      .select("price")
      .eq("status", "sold")
      .in("section", [...MARKETPLACE_SECTIONS])
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error("[feed-sold-stats] sum page", error)
      break
    }
    const rows = data ?? []
    for (const row of rows) {
      total += Number((row as { price?: unknown }).price) || 0
    }
    if (rows.length < pageSize) break
    offset += pageSize
  }
  return total
}

async function fetchSoldFeedStats(): Promise<{ soldCount: number; gmvTotal: number }> {
  const supabase = anonSupabase()

  const { count, error: countError } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "sold")
    .in("section", [...MARKETPLACE_SECTIONS])

  if (countError) {
    console.error("[feed-sold-stats] count", countError)
  }

  const gmvTotal = await sumSoldPricesPaged(supabase)

  return {
    soldCount: count ?? 0,
    gmvTotal,
  }
}

const getCachedSoldFeedStats = unstable_cache(fetchSoldFeedStats, ["marketplace-sold-feed-stats"], {
  revalidate: 600,
})

/** Cached ~10 minutes — public marketplace sold stats (surfboards). */
export function getSoldFeedStats(): Promise<{ soldCount: number; gmvTotal: number }> {
  return getCachedSoldFeedStats()
}
