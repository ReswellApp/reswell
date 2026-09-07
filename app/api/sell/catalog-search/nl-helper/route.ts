import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { runSellCatalogNlHelper } from "@/lib/services/sellCatalogNlHelper"
import { emptySellCatalogNlHelperResponse } from "@/lib/types/sell-catalog-nl-helper"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
} from "@/lib/types/sell-catalog-search"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
})

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
 * Parallel AI helper for the `/sell` catalog search wall.
 * GET /api/sell/catalog-search/nl-helper?q=...
 *
 * Called from the client after the primary catalog search settles weak or
 * empty — never blocks first results. Failures return a skipped payload so
 * the primary results always stand.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json(emptySellCatalogNlHelperResponse("empty_query"))
  }

  try {
    const categories = await resolveSearchableCategories()
    const supabase = createAnonSupabaseClient()
    const result = await runSellCatalogNlHelper(supabase, parsed.data.q, categories)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/sell/catalog-search/nl-helper] failed:", msg)
    return NextResponse.json(emptySellCatalogNlHelperResponse("error"), { status: 200 })
  }
}
