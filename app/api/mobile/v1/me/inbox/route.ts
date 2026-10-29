import { mobileInboxReadBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileInboxService, markMobileInboxNotificationReadService } from "@/lib/services/mobileInbox"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileInboxService(session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/inbox", error, "Unable to load your inbox right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileInboxReadBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid notification" }, "private, no-store")
    }
    const result = await markMobileInboxNotificationReadService(session.user.id, parsed.data.notification_id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/inbox", error, "Unable to update this notification right now")
  }
}
