import { readMobileSession } from "@/lib/auth/mobile-session"
import { listMobileSalesService } from "@/lib/services/mobileAccountApi"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listMobileSalesService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/sales", error, "Unable to load sales right now")
  }
}
