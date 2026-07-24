import type { SupabaseClient } from "@supabase/supabase-js"
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"
import { isUuidString } from "@/lib/utils/isUuid"

/** Lean listing row used only for computing facet availability counts. */
export type FacetCountRow = {
  board_type: string | null
  condition: string | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  length_total_inches: number | null
  volume_liters: number | null
  dimensions: string | null
  title: string | null
}

const FACET_COUNT_SELECT =
  "board_type, condition, fins_setup, fin_system, construction, length_total_inches, volume_liters, dimensions, title"

/** Hard cap on rows scanned for in-memory facet counting. */
const FACET_COUNT_MAX_ROWS = 5000

export type FacetCountContext = {
  query?: string
  brand?: string
  model?: string
  brandId?: string
  brandModelId?: string
  minPrice?: number
  maxPrice?: number
  location?: string
  /** When true, only listings where the seller offers shipping. */
  shippingAvailable?: boolean
}

function escapePostgrestIlikeFragment(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Fetches a lean row set (no facet checkbox filters applied) so facet option counts can be
 * computed in memory with proper cross-faceting. Geo/radius is intentionally excluded — counts
 * reflect catalog availability within the keyword/brand/price/location-text context.
 */
export async function fetchSurfboardFacetCountRows(
  supabase: SupabaseClient,
  ctx: FacetCountContext,
): Promise<FacetCountRow[]> {
  let dbQuery = supabase
    .from("listings")
    .select(FACET_COUNT_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .limit(FACET_COUNT_MAX_ROWS)

  if (ctx.minPrice != null && !Number.isNaN(ctx.minPrice) && ctx.minPrice >= 0) {
    dbQuery = dbQuery.gte("price", ctx.minPrice)
  }
  if (ctx.maxPrice != null && !Number.isNaN(ctx.maxPrice) && ctx.maxPrice >= 0) {
    dbQuery = dbQuery.lte("price", ctx.maxPrice)
  }
  if (ctx.shippingAvailable) {
    dbQuery = dbQuery.eq("shipping_available", true)
  }

  const brandModelId = ctx.brandModelId?.trim()
  const brandId = ctx.brandId?.trim()
  if (brandModelId && isUuidString(brandModelId)) {
    dbQuery = dbQuery.eq("brand_model_id", brandModelId)
  } else if (brandId && isUuidString(brandId)) {
    dbQuery = dbQuery.eq("brand_id", brandId)
  } else {
    const brand = ctx.brand?.trim()
    if (brand) dbQuery = dbQuery.ilike("brand", `%${brand}%`)
    const model = ctx.model?.trim()
    if (model) {
      const pat = `"%${escapePostgrestIlikeFragment(model)}%"`
      dbQuery = dbQuery.or(`model.ilike.${pat},title.ilike.${pat}`)
    }
  }

  const loc = ctx.location?.trim()
  if (loc) dbQuery = applyListingsLocationTextFilter(dbQuery, loc)

  const q = ctx.query?.trim()
  if (q) {
    const pat = `"%${escapePostgrestIlikeFragment(q)}%"`
    dbQuery = dbQuery.or(
      `title.ilike.${pat},description.ilike.${pat},brand.ilike.${pat},fins_setup.ilike.${pat},tail_shape.ilike.${pat}`,
    )
  }

  const { data, error } = await dbQuery
  if (error) {
    console.error("fetchSurfboardFacetCountRows:", error.message)
    return []
  }
  return (data ?? []) as FacetCountRow[]
}
