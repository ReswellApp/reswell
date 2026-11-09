import { NextRequest, NextResponse } from "next/server"
import { mobileMarketplaceFeedQuerySchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getMobileMarketplaceFeedService } from "@/lib/services/mobileMarketplaceFeed"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const parsed = mobileMarketplaceFeedQuerySchema.safeParse({
    tab: request.nextUrl.searchParams.get("tab") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    sold_at: request.nextUrl.searchParams.get("sold_at") ?? undefined,
    listing_id: request.nextUrl.searchParams.get("listing_id") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feed query" }, { status: 400 })
  }

  try {
    const session = await readOptionalMobileSession(request)
    if (session && !session.ok) return mobileDataResponse(session, "private, no-store")

    const result = await getMobileMarketplaceFeedService(
      parsed.data,
      session?.ok ? { supabase: session.supabase, userId: session.user.id } : undefined,
    )
    const cache = session?.ok ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300"
    return mobileDataResponse(result, cache)
  } catch (error) {
    return mobileFailure("/api/mobile/v1/feed", error, "Unable to load the feed right now")
  }
}
