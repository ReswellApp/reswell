import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getSellCatalogSearchCached,
  SELL_CATALOG_SEARCH_REVALIDATE_SECONDS,
} from "@/lib/cache/sell-catalog-search"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
} from "@/lib/types/sell-catalog-search"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { createClient } from "@/lib/supabase/server"

const querySchema = z.object({
  q: z.string().trim().min(1, "Enter a search term").max(200),
})

const CATEGORIES_WITHOUT_APPAREL: SellCatalogSearchCategory[] =
  SELL_CATALOG_SEARCH_CATEGORIES.filter((category) => category !== "apparel")

async function resolveIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? await fetchProfileIsAdmin(supabase, user.id) : false
}

/**
 * GET `/api/sell/catalog-search?q=...`
 * Cached cross-category catalog search for the `/sell` entry search wall.
 */
export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      q: new URL(req.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first?.message ?? "Enter a search term." },
        { status: 400 },
      )
    }

    const q = parsed.data.q
    const cacheHeaders = {
      "Cache-Control": `private, s-maxage=${SELL_CATALOG_SEARCH_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    }

    if (!APPAREL_SELL_ADMIN_ONLY) {
      const data = await getSellCatalogSearchCached(q, [...SELL_CATALOG_SEARCH_CATEGORIES])
      return NextResponse.json({ data }, { headers: cacheHeaders })
    }

    // Session + admin check runs in parallel with the public catalog lookup so
    // it is not on the critical path for almost every seller.
    const [isAdmin, publicData] = await Promise.all([
      resolveIsAdmin(),
      getSellCatalogSearchCached(q, CATEGORIES_WITHOUT_APPAREL),
    ])
    const data = isAdmin
      ? await getSellCatalogSearchCached(q, [...SELL_CATALOG_SEARCH_CATEGORIES])
      : publicData

    return NextResponse.json({ data }, { headers: cacheHeaders })
  } catch (error) {
    console.error(
      "[api/sell/catalog-search]",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Could not search the catalog. Please try again." },
      { status: 500 },
    )
  }
}
