import { NextRequest, NextResponse } from "next/server"
import { mobileProfileParamSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { loadPublicMobileProfileRow } from "@/lib/services/mobileApi"
import { openMobileSellerConversation } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { slug } = await context.params
    const parsed = mobileProfileParamSchema.safeParse({ slug })
    if (!parsed.success) return NextResponse.json({ error: "Invalid profile" }, { status: 400 })

    const profile = await loadPublicMobileProfileRow(parsed.data.slug)
    if (!profile.ok) return mobileDataResponse(profile, "private, no-store")

    const result = await openMobileSellerConversation(session.supabase, session.user, profile.data.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/profiles/[slug]/conversation",
      error,
      "Could not open this conversation right now",
    )
  }
}
