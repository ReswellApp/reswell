import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  FIN_CATALOG_SEARCH_SELL_REVALIDATE_SECONDS,
  getFinCatalogSearchSellCached,
} from "@/lib/cache/fin-catalog-search-sell"

const querySchema = z.object({
  q: z.string().trim().min(1, "Enter a search term").max(200),
})

/**
 * GET `/api/sell/fins/catalog-search?q=...`
 * Cached fin catalog search for the `/sell/fins` entry step.
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

    const data = await getFinCatalogSearchSellCached(parsed.data.q)

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${FIN_CATALOG_SEARCH_SELL_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
        },
      },
    )
  } catch (error) {
    console.error(
      "[api/sell/fins/catalog-search]",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Could not search the fin catalog. Please try again." },
      { status: 500 },
    )
  }
}
