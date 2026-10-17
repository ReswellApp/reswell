import { NextRequest, NextResponse } from "next/server"
import { mobileProfileParamSchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getMobileSellerPageService } from "@/lib/services/mobileSellers"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsed = mobileProfileParamSchema.safeParse({ slug })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid seller" }, { status: 400 })
    }

    const session = await readOptionalMobileSession(request)
    if (session && !session.ok) return mobileDataResponse(session, "private, no-store")

    const result = await getMobileSellerPageService(
      parsed.data.slug,
      session?.ok ? { supabase: session.supabase, userId: session.user.id } : undefined,
    )
    return mobileDataResponse(
      result,
      session?.ok ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120",
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sellers/[slug]", error, "Unable to load this seller right now")
  }
}
