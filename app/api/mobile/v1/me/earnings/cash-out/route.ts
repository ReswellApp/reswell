import { mobileCashOutBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { cashOutMobileEarningsService } from "@/lib/services/mobileEarnings"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")

    const parsed = mobileCashOutBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      const message = parsed.error.flatten().formErrors[0] ?? "Invalid amount"
      return mobileDataResponse({ ok: false, status: 400, error: message }, "private, no-store")
    }

    const result = await cashOutMobileEarningsService(session.supabase, {
      id: session.user.id,
      email: session.user.email ?? null,
    }, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/earnings/cash-out", error, "Payout failed")
  }
}
