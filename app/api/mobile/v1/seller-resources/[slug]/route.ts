import { NextRequest, NextResponse } from "next/server"
import { MOBILE_SELLER_RESOURCE_SLUGS } from "@reswell/api-contract"
import { z } from "zod"
import { getMobileSellerResource } from "@/lib/services/mobileSellerResource"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

const paramsSchema = z.object({
  slug: z.enum(MOBILE_SELLER_RESOURCE_SLUGS),
})

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsed = paramsSchema.safeParse({ slug })
    if (!parsed.success) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }
    const result = await getMobileSellerResource(parsed.data.slug)
    return mobileDataResponse(result, "public, max-age=30, s-maxage=60, stale-while-revalidate=120")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/seller-resources", error, "Unable to load this page right now")
  }
}
