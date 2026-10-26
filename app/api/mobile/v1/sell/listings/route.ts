import { NextResponse } from "next/server"
import { mobileSellPublishSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { publishMobileListingService } from "@/lib/services/mobileSellPublish"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** POST `/api/mobile/v1/sell/listings` — publish the sell-screen draft as an active listing. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileSellPublishSchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the listing and try again" }, { status: 400 })
    }
    const result = await publishMobileListingService(session.supabase, session.user.id, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/listings", error, "Couldn't publish this listing")
  }
}
