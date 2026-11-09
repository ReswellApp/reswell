import { readMobileSession } from "@/lib/auth/mobile-session"
import { deleteMemberAccountService } from "@/lib/services/accountDeletion"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** DELETE `/api/mobile/v1/me/account` — self-serve account deletion (App Store 5.1.1). */
export async function DELETE(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await deleteMemberAccountService(session.user)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/account", error, "Couldn't delete your account right now.")
  }
}
