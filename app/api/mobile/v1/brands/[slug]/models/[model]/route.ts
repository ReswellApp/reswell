import { NextResponse } from "next/server"
import { mobileModelParamSchema } from "@reswell/api-contract"
import { getMobileModelPageService } from "@/lib/services/mobileBrands"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string; model: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const parsed = mobileModelParamSchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 })
    }
    const result = await getMobileModelPageService(parsed.data.slug, parsed.data.model)
    return mobileDataResponse(result, "public, s-maxage=60, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/brands/[slug]/models/[model]", error, "Unable to load this model right now")
  }
}
