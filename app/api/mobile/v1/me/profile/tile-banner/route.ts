import { NextResponse } from "next/server"
import { readMobileSession } from "@/lib/auth/mobile-session"
import {
  removeMobileProfileTileBannerService,
  uploadMobileProfileTileBannerService,
} from "@/lib/services/mobileProfileSettings"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** POST `/api/mobile/v1/me/profile/tile-banner` — shop tile photo, same processing as the website. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo" }, { status: 400 })
    }
    if (file.size > PROFILE_BANNER_MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${Math.round(PROFILE_BANNER_MAX_INPUT_BYTES / (1024 * 1024))}MB` },
        { status: 400 },
      )
    }
    const result = await uploadMobileProfileTileBannerService(session.supabase, session.user.id, file)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/tile-banner", error, "Unable to update your tile banner right now")
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await removeMobileProfileTileBannerService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/tile-banner", error, "Unable to remove your tile banner right now")
  }
}
