import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"
import { formatCondition } from "@/lib/listing-labels"
import { moneyUsd } from "@/lib/price-guide/stats"
import type { PriceGuideComp, PriceGuideCompSource } from "@/lib/types/price-guide"

const COMP_SELECT = `
  id,
  entry_id,
  listing_id,
  sold_price_usd,
  sold_at,
  condition,
  dimensions,
  title,
  source,
  source_url,
  notes,
  include_in_public,
  created_at
`

type RawComp = {
  id: string
  entry_id: string
  listing_id: string | null
  sold_price_usd: number | string
  sold_at: string
  condition: string | null
  dimensions: string | null
  title: string | null
  source: PriceGuideCompSource
  source_url: string | null
  notes: string | null
  include_in_public: boolean
}

const SOURCE_LABEL: Record<PriceGuideCompSource, string> = {
  reswell: "Reswell",
  fb_marketplace: "Facebook Marketplace",
  craigslist: "Craigslist",
  ebay: "eBay",
  shop: "Shop / retail",
  other: "Other",
}

export function mapManualComp(raw: RawComp): PriceGuideComp {
  const price = moneyUsd(raw.sold_price_usd) ?? 0
  return {
    id: raw.id,
    sold_price_usd: price,
    sold_at: raw.sold_at.slice(0, 10),
    condition: raw.condition,
    condition_label: raw.condition ? formatCondition(raw.condition) : null,
    dimensions: raw.dimensions,
    title: raw.title,
    source: raw.source,
    source_label: SOURCE_LABEL[raw.source],
    listing_url: raw.source_url,
    include_in_public: raw.include_in_public,
  }
}

export async function listPriceGuideCompsForEntries(
  supabase: SupabaseClient,
  entryIds: string[],
  publicOnly: boolean,
): Promise<Map<string, PriceGuideComp[]>> {
  const out = new Map<string, PriceGuideComp[]>()
  if (entryIds.length === 0) return out

  let query = supabase
    .from("price_guide_manual_comps")
    .select(COMP_SELECT)
    .in("entry_id", entryIds)
    .order("sold_at", { ascending: false })
    .limit(400)

  if (publicOnly) query = query.eq("include_in_public", true)

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[price-guide] list comps:", error.message)
    return out
  }

  for (const raw of data as RawComp[]) {
    const list = out.get(raw.entry_id) ?? []
    list.push(mapManualComp(raw))
    out.set(raw.entry_id, list)
  }
  return out
}

export async function insertPriceGuideComp(
  supabase: SupabaseClient,
  input: {
    entry_id: string
    sold_price_usd: number
    sold_at: string
    condition: string | null
    dimensions: string | null
    title: string | null
    source: PriceGuideCompSource
    source_url: string | null
    notes: string | null
    include_in_public: boolean
    listing_id: string | null
    created_by: string
  },
): Promise<{ ok: true; row: PriceGuideComp } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("price_guide_manual_comps")
    .insert(input)
    .select(COMP_SELECT)
    .single()

  if (error || !data) {
    console.error("[price-guide] insert comp:", error?.message)
    return { ok: false, error: "Could not add comparable sale" }
  }
  return { ok: true, row: mapManualComp(data as RawComp) }
}

export async function deletePriceGuideComp(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("price_guide_manual_comps").delete().eq("id", id)
  if (error) {
    console.error("[price-guide] delete comp:", error.message)
    return { ok: false, error: "Could not delete comparable sale" }
  }
  return { ok: true }
}

export function listingHrefForComp(listing: {
  id: string
  slug: string | null
}): string {
  return listingDetailHref({ id: listing.id, slug: listing.slug })
}
