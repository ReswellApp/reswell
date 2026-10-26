import { NextRequest, NextResponse } from "next/server"
import { mobileProfileParamSchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getMobileProfileService } from "@/lib/services/mobileApi"
import { mobileDataResponse } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const parsed = mobileProfileParamSchema.safeParse({ slug })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile" }, { status: 400 })
    }

    const session = await readOptionalMobileSession(request)
    if (session && !session.ok) return mobileDataResponse(session, "private, no-store")

    const result = await getMobileProfileService(
      parsed.data.slug,
      session?.ok ? { supabase: session.supabase, userId: session.user.id } : undefined,
    )
    return mobileDataResponse(
      result,
      session?.ok ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120",
    )
  } catch (error) {
    console.error("[mobile-api] profile failed", {
      route: "/api/mobile/v1/profiles/[slug]",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load profile right now" }, { status: 500 })
  }
}
