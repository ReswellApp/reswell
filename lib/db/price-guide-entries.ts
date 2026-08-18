import type { SupabaseClient } from "@supabase/supabase-js"
import type { PriceGuideCategorySlug } from "@/lib/price-guide/categories"
import { moneyUsd } from "@/lib/price-guide/stats"
import type {
  PriceGuideConditionBand,
  PriceGuideConfidence,
  PriceGuideEntryRecord,
  PriceGuidePricingSource,
  PriceGuideStatus,
} from "@/lib/types/price-guide"

const ENTRY_SELECT = `
  id,
  category_slug,
  brand_id,
  brand_model_id,
  status,
  featured,
  sort_order,
  pricing_source,
  typical_low_usd,
  typical_mid_usd,
  typical_high_usd,
  new_retail_usd,
  condition_bands,
  headline,
  summary,
  body,
  confidence,
  notes_internal,
  last_reviewed_at,
  reviewed_by,
  created_by,
  created_at,
  updated_at
`

type RawEntry = {
  id: string
  category_slug: string
  brand_id: string | null
  brand_model_id: string | null
  status: PriceGuideStatus
  featured: boolean
  sort_order: number
  pricing_source: PriceGuidePricingSource
  typical_low_usd: number | string | null
  typical_mid_usd: number | string | null
  typical_high_usd: number | string | null
  new_retail_usd: number | string | null
  condition_bands: unknown
  headline: string | null
  summary: string | null
  body: string | null
  confidence: PriceGuideConfidence | null
  notes_internal: string | null
  last_reviewed_at: string | null
  reviewed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function parseConditionBands(raw: unknown): PriceGuideConditionBand[] {
  if (!Array.isArray(raw)) return []
  const bands: PriceGuideConditionBand[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.condition !== "string") continue
    bands.push({
      condition: row.condition,
      condition_label:
        typeof row.condition_label === "string" ? row.condition_label : row.condition,
      low_usd: moneyUsd(row.low_usd as number | string | null),
      mid_usd: moneyUsd(row.mid_usd as number | string | null),
      high_usd: moneyUsd(row.high_usd as number | string | null),
      sample_count:
        typeof row.sample_count === "number" && Number.isFinite(row.sample_count)
          ? row.sample_count
          : 0,
    })
  }
  return bands
}

export function mapPriceGuideEntry(raw: RawEntry): PriceGuideEntryRecord {
  return {
    id: raw.id,
    category_slug: raw.category_slug as PriceGuideCategorySlug,
    brand_id: raw.brand_id,
    brand_model_id: raw.brand_model_id,
    status: raw.status,
    featured: raw.featured,
    sort_order: raw.sort_order,
    pricing_source: raw.pricing_source,
    typical_low_usd: moneyUsd(raw.typical_low_usd),
    typical_mid_usd: moneyUsd(raw.typical_mid_usd),
    typical_high_usd: moneyUsd(raw.typical_high_usd),
    new_retail_usd: moneyUsd(raw.new_retail_usd),
    condition_bands: parseConditionBands(raw.condition_bands),
    headline: raw.headline,
    summary: raw.summary,
    body: raw.body,
    confidence: raw.confidence,
    notes_internal: raw.notes_internal,
    last_reviewed_at: raw.last_reviewed_at,
    reviewed_by: raw.reviewed_by,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

export async function listPriceGuideEntries(
  supabase: SupabaseClient,
  filters?: { status?: PriceGuideStatus; categorySlug?: PriceGuideCategorySlug },
): Promise<PriceGuideEntryRecord[]> {
  let query = supabase
    .from("price_guide_entries")
    .select(ENTRY_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500)

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.categorySlug) query = query.eq("category_slug", filters.categorySlug)

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error("[price-guide] list entries:", error.message)
    return []
  }
  return (data as RawEntry[]).map(mapPriceGuideEntry)
}

export async function listPublishedFeaturedPriceGuideEntries(
  supabase: SupabaseClient,
  limit = 12,
): Promise<PriceGuideEntryRecord[]> {
  const { data, error } = await supabase
    .from("price_guide_entries")
    .select(ENTRY_SELECT)
    .eq("status", "published")
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .limit(limit)

  if (error || !data) {
    if (error) console.error("[price-guide] featured entries:", error.message)
    return []
  }
  return (data as RawEntry[]).map(mapPriceGuideEntry)
}

export async function getPriceGuideEntryById(
  supabase: SupabaseClient,
  id: string,
): Promise<PriceGuideEntryRecord | null> {
  const { data, error } = await supabase
    .from("price_guide_entries")
    .select(ENTRY_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[price-guide] get entry:", error.message)
    return null
  }
  return data ? mapPriceGuideEntry(data as RawEntry) : null
}

export async function getPriceGuideEntryByScope(
  supabase: SupabaseClient,
  scope: {
    categorySlug: PriceGuideCategorySlug
    brandId: string | null
    brandModelId: string | null
  },
): Promise<PriceGuideEntryRecord | null> {
  let query = supabase
    .from("price_guide_entries")
    .select(ENTRY_SELECT)
    .eq("category_slug", scope.categorySlug)
    .limit(1)

  if (scope.brandId) query = query.eq("brand_id", scope.brandId)
  else query = query.is("brand_id", null)

  if (scope.brandModelId) query = query.eq("brand_model_id", scope.brandModelId)
  else query = query.is("brand_model_id", null)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("[price-guide] get entry by scope:", error.message)
    return null
  }
  return data ? mapPriceGuideEntry(data as RawEntry) : null
}

export async function insertPriceGuideEntry(
  supabase: SupabaseClient,
  input: {
    category_slug: PriceGuideCategorySlug
    brand_id: string | null
    brand_model_id: string | null
    created_by: string
  },
): Promise<{ ok: true; row: PriceGuideEntryRecord } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("price_guide_entries")
    .insert({
      category_slug: input.category_slug,
      brand_id: input.brand_id,
      brand_model_id: input.brand_model_id,
      created_by: input.created_by,
    })
    .select(ENTRY_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "A guide already exists for this brand or model." }
    }
    console.error("[price-guide] insert entry:", error?.message)
    return { ok: false, error: "Could not create price guide entry" }
  }
  return { ok: true, row: mapPriceGuideEntry(data as RawEntry) }
}

export async function updatePriceGuideEntry(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; row: PriceGuideEntryRecord } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("price_guide_entries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(ENTRY_SELECT)
    .single()

  if (error || !data) {
    console.error("[price-guide] update entry:", error?.message)
    return { ok: false, error: "Could not update price guide entry" }
  }
  return { ok: true, row: mapPriceGuideEntry(data as RawEntry) }
}

export async function deletePriceGuideEntry(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("price_guide_entries").delete().eq("id", id)
  if (error) {
    console.error("[price-guide] delete entry:", error.message)
    return { ok: false, error: "Could not delete price guide entry" }
  }
  return { ok: true }
}
