import type { SupabaseClient } from "@supabase/supabase-js"
import { FINS_SECTION } from "@/lib/fin-listing-config"

/** Lean listing row used only for computing fin browse facet availability counts. */
export type FinFacetCountRow = {
  title: string | null
  brand: string | null
  model: string | null
  description: string | null
  condition: string | null
  fins_setup: string | null
  fin_system: string | null
  fin_size: string | null
}

const FIN_FACET_COUNT_SELECT =
  "title, brand, model, description, condition, fins_setup, fin_system, fin_size"

/** Hard cap on rows scanned for in-memory facet counting. */
const FACET_COUNT_MAX_ROWS = 5000

export type FinFacetCountContext = {
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
}

function escapePostgrestIlikeFragment(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Fetches a lean row set (no facet checkbox filters applied) so facet option counts can be
 * computed in memory with proper cross-faceting.
 */
export async function fetchFinFacetCountRows(
  supabase: SupabaseClient,
  ctx: FinFacetCountContext,
): Promise<FinFacetCountRow[]> {
  let dbQuery = supabase
    .from("listings")
    .select(FIN_FACET_COUNT_SELECT)
    .eq("status", "active")
    .eq("section", FINS_SECTION)
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .limit(FACET_COUNT_MAX_ROWS)

  if (ctx.minPrice != null && !Number.isNaN(ctx.minPrice) && ctx.minPrice >= 0) {
    dbQuery = dbQuery.gte("price", ctx.minPrice)
  }
  if (ctx.maxPrice != null && !Number.isNaN(ctx.maxPrice) && ctx.maxPrice >= 0) {
    dbQuery = dbQuery.lte("price", ctx.maxPrice)
  }

  const brand = ctx.brand?.trim()
  if (brand) dbQuery = dbQuery.ilike("brand", `%${escapePostgrestIlikeFragment(brand)}%`)

  const q = ctx.query?.trim()
  if (q) {
    const pat = `"%${escapePostgrestIlikeFragment(q)}%"`
    dbQuery = dbQuery.or(
      `title.ilike.${pat},description.ilike.${pat},brand.ilike.${pat},model.ilike.${pat},fins_setup.ilike.${pat},fin_system.ilike.${pat}`,
    )
  }

  const { data, error } = await dbQuery
  if (error) {
    console.error("fetchFinFacetCountRows:", error.message)
    return []
  }
  return (data ?? []) as FinFacetCountRow[]
}
