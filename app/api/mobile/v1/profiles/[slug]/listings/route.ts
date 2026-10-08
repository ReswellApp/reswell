import { NextRequest } from "next/server"
import { mobileProfileListingsQuerySchema, mobileProfileParamSchema } from "@reswell/api-contract"
import { listMobileProfileListingsService } from "@/lib/services/mobileAccountApi"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsedSlug = mobileProfileParamSchema.safeParse({ slug })
    const parsedQuery = mobileProfileListingsQuerySchema.safeParse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    })
    if (!parsedSlug.success || !parsedQuery.success) {
      return mobileDataResponse(
        { ok: false, status: 400, error: "Invalid profile listings query" },
        "no-store",
      )
    }

    const result = await listMobileProfileListingsService(parsedSlug.data.slug, parsedQuery.data)
    return mobileDataResponse(result, "public, s-maxage=30, stale-while-revalidate=120")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/profiles/[slug]/listings", error, "Unable to load listings right now")
  }
}
