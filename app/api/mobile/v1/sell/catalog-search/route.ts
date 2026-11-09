import { NextResponse } from "next/server"
import { mobileSellCatalogQuerySchema } from "@reswell/api-contract"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { searchMobileSellCatalog } from "@/lib/services/mobileSellCatalog"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/**
 * GET `/api/mobile/v1/sell/catalog-search?q=...`
 * Brand and model suggestions for the sell flow. Same index as the website.
 */
export async function GET(request: Request) {
  try {
    const parsed = mobileSellCatalogQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a search term" }, { status: 400 })
    }

    let isAdmin = false
    if (APPAREL_SELL_ADMIN_ONLY) {
      const session = await readOptionalMobileSession(request)
      if (session && !session.ok) {
        return NextResponse.json({ error: session.error }, { status: session.status })
      }
      if (session?.ok) isAdmin = await fetchProfileIsAdmin(session.supabase, session.user.id)
    }

    const data = await searchMobileSellCatalog(parsed.data.q, isAdmin)
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, max-age=30" } },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/catalog-search", error, "Could not search the catalog. Please try again.")
  }
}
