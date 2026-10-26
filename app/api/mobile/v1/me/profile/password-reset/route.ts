import { readMobileSession } from "@/lib/auth/mobile-session"
import { sendMobileProfilePasswordResetService } from "@/lib/services/mobileProfileSignIn"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** POST `/api/mobile/v1/me/profile/password-reset` — emails the same recovery link as the website. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await sendMobileProfilePasswordResetService(session.user)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/password-reset", error, "Couldn't send the reset email.")
  }
}
