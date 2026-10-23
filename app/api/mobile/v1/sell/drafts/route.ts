import { NextResponse } from "next/server"
import { mobileSellDraftSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { saveMobileSellDraftService } from "@/lib/services/mobileSellPublish"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** POST `/api/mobile/v1/sell/drafts` — save the sell form as a hidden website draft. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileSellDraftSchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the listing and try again" }, { status: 400 })
    }
    const result = await saveMobileSellDraftService(session.supabase, session.user.id, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/drafts", error, "Couldn't save this draft")
  }
}
