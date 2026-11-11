import { after, NextRequest, NextResponse } from "next/server"
import { mobileListingParamSchema } from "@reswell/api-contract"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { getMobileListingService } from "@/lib/services/mobileApi"
import { recordPublicListingView } from "@/lib/services/listingViews"
import { mobileDataResponse } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function logListingViewFailure(listingId: string, message: string) {
  console.error("[mobile-api] listing view was not recorded", {
    listingId,
    timestamp: new Date().toISOString(),
    message,
  })
}

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
      const listingId = result.data.id
      const viewerUserId = session.user.id
      const supabase = session.supabase
      const recordView = () =>
        recordPublicListingView(supabase, { listingId, viewerUserId })
          .then((recorded) => {
            if (!recorded.ok) logListingViewFailure(listingId, recorded.message)
          })
          .catch((error: unknown) => {
            logListingViewFailure(
              listingId,
              error instanceof Error ? error.message : String(error),
            )
          })
      // Next.js holds the response for un-awaited promises; after() returns JSON first.
      try {
        after(recordView)
      } catch {
        void recordView()
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
