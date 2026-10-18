import { NextResponse } from "next/server"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { removeMobileProfileAvatarService, uploadMobileProfileAvatarService } from "@/lib/services/mobileProfileSettings"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB` },
        { status: 400 },
      )
    }
    const result = await uploadMobileProfileAvatarService(session.supabase, session.user.id, file)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/avatar", error, "Unable to update your photo right now")
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await removeMobileProfileAvatarService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/avatar", error, "Unable to remove your photo right now")
  }
}
