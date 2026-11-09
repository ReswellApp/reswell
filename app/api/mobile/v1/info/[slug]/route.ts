import { NextResponse } from "next/server"
import { MOBILE_INFO_PAGE_SLUGS } from "@reswell/api-contract"
import { z } from "zod"
import { getMobileInfoPage } from "@/lib/services/mobileInfoPage"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

const paramsSchema = z.object({
  slug: z.enum(MOBILE_INFO_PAGE_SLUGS),
})

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsed = paramsSchema.safeParse({ slug })
    if (!parsed.success) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }
    return mobileDataResponse(
      getMobileInfoPage(parsed.data.slug),
      "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/info", error, "Unable to load this page right now")
  }
}
