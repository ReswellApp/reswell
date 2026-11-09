import { readMobileSession } from "@/lib/auth/mobile-session"
import { sendMobilePushTestService } from "@/lib/services/mobilePushTokens"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await sendMobilePushTestService(session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/push-tokens/test", error, "Unable to send a test alert right now")
  }
}
