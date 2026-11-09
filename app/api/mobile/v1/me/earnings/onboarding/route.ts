import { readMobileSession } from "@/lib/auth/mobile-session"
import { createMobilePayoutOnboardingService } from "@/lib/services/mobileEarnings"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await createMobilePayoutOnboardingService(session.supabase, session.user.id, session.user.email ?? null)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/earnings/onboarding", error, "Could not open Stripe verification. Try again shortly.")
  }
}
