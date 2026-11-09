import { NextResponse } from "next/server"
import { mobileSellBrandModelsQuerySchema } from "@reswell/api-contract"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { listMobileSellBrandModels } from "@/lib/services/mobileSellCatalog"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/**
 * GET `/api/mobile/v1/sell/catalog-search/brand-models?brand_id=...`
 * One brand's catalog models for the sell model picker. Same source as the website
 * `/api/sell/catalog-search/brand-models` route.
 */
export async function GET(request: Request) {
  try {
    const parsed = mobileSellBrandModelsQuerySchema.safeParse({
      brand_id: new URL(request.url).searchParams.get("brand_id") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 })
    }

    let isAdmin = false
    if (APPAREL_SELL_ADMIN_ONLY) {
      const session = await readOptionalMobileSession(request)
      if (session && !session.ok) {
        return NextResponse.json({ error: session.error }, { status: session.status })
      }
      if (session?.ok) isAdmin = await fetchProfileIsAdmin(session.supabase, session.user.id)
    }

    const data = await listMobileSellBrandModels(parsed.data.brand_id, isAdmin)
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, max-age=60" } },
    )
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/sell/catalog-search/brand-models",
      error,
      "Could not load brand models. Please try again.",
    )
  }
}
