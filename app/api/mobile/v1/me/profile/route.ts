import { mobileProfileSettingsPatchSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileProfileSettingsService, updateMobileProfileSettingsService } from "@/lib/services/mobileProfileSettings"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileProfileSettingsService(session.supabase, session.user)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile", error, "Unable to load your profile right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const body = mobileProfileSettingsPatchSchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? "Check the profile fields." }, { status: 400 })
    }
    const result = await updateMobileProfileSettingsService(session.supabase, session.user, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile", error, "Unable to save your profile right now")
  }
}
