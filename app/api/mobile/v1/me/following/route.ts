import { NextResponse } from "next/server"
import { mobileFollowBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { listMobileFollowingService } from "@/lib/services/mobileAccountApi"
import { setMobileFollow } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listMobileFollowingService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/following", error, "Unable to load following right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileFollowBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) return NextResponse.json({ error: "Invalid follow" }, { status: 400 })
    const result = await setMobileFollow(session.supabase, session.user, parsed.data.seller_id, parsed.data.following)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/following", error, "Unable to update this follow right now")
  }
}
