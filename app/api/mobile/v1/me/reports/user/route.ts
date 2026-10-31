import { mobileUserReportBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { reportUserService } from "@/lib/services/mobileSafetyReport"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileUserReportBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse(
        { ok: false, status: 400, error: "Add who you're reporting and a short reason." },
        "private, no-store",
      )
    }
    const result = await reportUserService(session.supabase, session.user, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/reports/user", error, "Couldn't send that report.")
  }
}
