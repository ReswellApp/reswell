import { NextResponse } from "next/server"
import { MOBILE_LISTING_CATEGORIES } from "@reswell/api-contract"
import { mobileCategoryFor } from "@/lib/services/mobileCategoryCatalog"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  if (!MOBILE_LISTING_CATEGORIES.includes(slug as (typeof MOBILE_LISTING_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }
  return NextResponse.json(
    { data: mobileCategoryFor(slug as (typeof MOBILE_LISTING_CATEGORIES)[number]) },
    {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
    },
  )
}
