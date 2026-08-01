import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getNavSearchSuggestCached,
  NAV_SEARCH_SUGGEST_REVALIDATE_SECONDS,
} from "@/lib/cache/nav-search-suggest"
import type { NavSearchSuggestSectionKey } from "@/lib/header-nav-marketplace-search"
import { normalizeMarketplaceSearchSuggestQuery } from "@/lib/services/marketplaceSearchSuggest"

/** Keep in sync with `NavSearchSuggestSectionKey` (+ empty = unscoped marketplace). */
const NAV_SEARCH_SUGGEST_SECTIONS = [
  "",
  "surfboards",
  "fins",
  "wetsuits",
  "magazines",
  "new",
  "marketplace",
] as const satisfies readonly (NavSearchSuggestSectionKey | "")[]

const sectionSchema = z.enum(NAV_SEARCH_SUGGEST_SECTIONS)

/**
 * GET `/api/nav/search-suggest?q=chan&section=surfboards`
 * Cached marketplace typeahead for header nav search (Top listings, brands, categories).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = normalizeMarketplaceSearchSuggestQuery(searchParams.get("q") ?? "")
    if (q.length < 2) {
      return NextResponse.json({ error: "Query too short" }, { status: 400 })
    }

    const parsedSection = sectionSchema.safeParse(searchParams.get("section") ?? "")
    if (!parsedSection.success) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const result = await getNavSearchSuggestCached(q, parsedSection.data)

    const cacheControl =
      process.env.NODE_ENV === "development"
        ? "private, no-store"
        : `public, s-maxage=${NAV_SEARCH_SUGGEST_REVALIDATE_SECONDS}, stale-while-revalidate=600`

    return NextResponse.json(
      { data: result },
      {
        headers: {
          "Cache-Control": cacheControl,
        },
      },
    )
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
