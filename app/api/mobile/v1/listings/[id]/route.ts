import { NextRequest, NextResponse } from "next/server"
import { mobileListingParamSchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getMobileListingService } from "@/lib/services/mobileApi"
import { recordPublicListingView } from "@/lib/services/listingViews"
import { mobileDataResponse } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const parsed = mobileListingParamSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const session = await readOptionalMobileSession(request)
    if (session && !session.ok) return mobileDataResponse(session, "private, no-store")

    const result = await getMobileListingService(
      parsed.data.id,
      session?.ok ? { supabase: session.supabase, userId: session.user.id } : undefined,
    )
    if (session?.ok && result.ok) {
      const recorded = await recordPublicListingView(session.supabase, {
        listingId: result.data.id,
        viewerUserId: session.user.id,
      })
      if (!recorded.ok) {
        console.error("[mobile-api] listing view was not recorded", {
          timestamp: new Date().toISOString(),
          message: recorded.message,
        })
      }
    }
    return mobileDataResponse(
      result,
      session?.ok ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120",
    )
  } catch (error) {
    console.error("[mobile-api] listing failed", {
      route: "/api/mobile/v1/listings/[id]",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load listing right now" }, { status: 500 })
  }
}
