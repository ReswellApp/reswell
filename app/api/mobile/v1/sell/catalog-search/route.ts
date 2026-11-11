import { NextResponse } from "next/server"
import { mobileSellCatalogQuerySchema } from "@reswell/api-contract"
import { searchMobileSellCatalog } from "@/lib/services/mobileSellCatalog"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/**
 * GET `/api/mobile/v1/sell/catalog-search?q=...`
 * Brand suggestions for the sell form. Same pipeline as the website
 * `searchBrandsCatalogSuggest` action — brands only. Models are
 * `GET /api/mobile/v1/sell/catalog-search/brand-models`.
 */
export async function GET(request: Request) {
  try {
    const parsed = mobileSellCatalogQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a search term" }, { status: 400 })
    }

    const data = await searchMobileSellCatalog(parsed.data.q)
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, max-age=30" } },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/catalog-search", error, "Could not search the catalog. Please try again.")
  }
}
