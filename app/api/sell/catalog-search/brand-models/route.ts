import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSellBrandCatalogModelsCached } from "@/lib/cache/sell-brand-catalog-models"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
} from "@/lib/types/sell-catalog-search"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { createClient } from "@/lib/supabase/server"

const querySchema = z.object({
  brand_id: z.string().trim().uuid(),
})

/** Same apparel gating as the main catalog-search route. */
async function resolveSearchableCategories(): Promise<SellCatalogSearchCategory[]> {
  if (!APPAREL_SELL_ADMIN_ONLY) return [...SELL_CATALOG_SEARCH_CATEGORIES]

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAdmin = user ? await fetchProfileIsAdmin(supabase, user.id) : false
  return SELL_CATALOG_SEARCH_CATEGORIES.filter(
    (category) => category !== "apparel" || isAdmin,
  )
}

/**
 * GET `/api/sell/catalog-search/brand-models?brand_id=...`
 * One brand's catalog models as sell search rows — the `/sell` trending-brand
 * drill-in ("Which {brand} model is it?").
 */
export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      brand_id: req.nextUrl.searchParams.get("brand_id") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 })
    }

    const categories = await resolveSearchableCategories()
    const rows = await getSellBrandCatalogModelsCached(parsed.data.brand_id, categories)

    return NextResponse.json({ data: { rows } }, { status: 200 })
  } catch (error) {
    console.error(
      "[api/sell/catalog-search/brand-models]",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Could not load brand models. Please try again." },
      { status: 500 },
    )
  }
}
