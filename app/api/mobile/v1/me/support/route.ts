import { mobileSupportCreateBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { listMobileSupportCasesService, openMobileSupportCaseService } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listMobileSupportCasesService(session.supabase, session.user)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/support", error, "Unable to load support right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileSupportCreateBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Add a subject and a message of at least 10 characters." }, "private, no-store")
    }
    const result = await openMobileSupportCaseService(session.supabase, session.user, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/support", error, "Unable to open a support case right now")
  }
}
