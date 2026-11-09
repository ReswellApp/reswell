import { NextResponse } from "next/server"
import { mobileBrandParamSchema } from "@reswell/api-contract"
import { getMobileBrandPageService } from "@/lib/services/mobileBrands"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsed = mobileBrandParamSchema.safeParse({ slug })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 })
    }
    const result = await getMobileBrandPageService(parsed.data.slug)
    return mobileDataResponse(result, "public, s-maxage=60, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/brands/[slug]", error, "Unable to load this brand right now")
  }
}
