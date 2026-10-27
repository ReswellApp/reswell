import { NextRequest } from "next/server"
import { mobileProfileParamSchema, mobileProfileShopFiltersQuerySchema } from "@reswell/api-contract"
import { getMobileProfileShopFiltersService } from "@/lib/services/mobileProfileShop"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsedSlug = mobileProfileParamSchema.safeParse({ slug })
    const parsedQuery = mobileProfileShopFiltersQuerySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    })
    if (!parsedSlug.success || !parsedQuery.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid shop filters query" }, "no-store")
    }

    const result = await getMobileProfileShopFiltersService(parsedSlug.data.slug, parsedQuery.data.status)
    return mobileDataResponse(result, "public, s-maxage=60, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/profiles/[slug]/shop-filters", error, "Unable to load shop filters right now")
  }
}
