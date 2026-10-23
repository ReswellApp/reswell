import { NextRequest, NextResponse } from "next/server"
import { mobileListingParamSchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getListingPdpRailsService } from "@/lib/services/listingPdpRails"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

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

    const result = await getListingPdpRailsService(
      parsed.data.id,
      session?.ok ? { supabase: session.supabase, userId: session.user.id } : undefined,
    )
    return mobileDataResponse(
      result,
      session?.ok ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300",
    )
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/listings/[id]/rails",
      error,
      "Unable to load listing recommendations right now",
    )
  }
}
