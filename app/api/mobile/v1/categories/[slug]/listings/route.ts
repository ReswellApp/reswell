import { NextRequest, NextResponse } from "next/server"
import { MOBILE_LISTING_CATEGORIES, mobileCategoryListingsQuerySchema } from "@reswell/api-contract"
import { listMobileCategoryListingsService } from "@/lib/services/mobileCategoryListings"
import { mobileDataResponse } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    if (!MOBILE_LISTING_CATEGORIES.includes(slug as (typeof MOBILE_LISTING_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }
    const params = request.nextUrl.searchParams
    const parsed = mobileCategoryListingsQuerySchema.safeParse({
      offset: params.get("offset") ?? undefined,
      sort: params.get("sort") ?? undefined,
      shipping: params.get("shipping") ?? undefined,
      type: params.get("type") ?? undefined,
      style: params.get("style") ?? undefined,
      condition: params.get("condition") ?? undefined,
      fin: params.get("fin") ?? undefined,
      finSystem: params.get("finSystem") ?? undefined,
      construction: params.get("construction") ?? undefined,
      length: params.get("length") ?? undefined,
      volume: params.get("volume") ?? undefined,
      size: params.get("size") ?? undefined,
      kind: params.get("kind") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid listings query" }, { status: 400 })
    }
    const result = await listMobileCategoryListingsService(
      slug as (typeof MOBILE_LISTING_CATEGORIES)[number],
      parsed.data,
    )
    return mobileDataResponse(result, "public, s-maxage=30, stale-while-revalidate=120")
  } catch (error) {
    console.error("[mobile-api] category listings failed", {
      route: "/api/mobile/v1/categories/[slug]/listings",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load listings right now" }, { status: 500 })
  }
}
