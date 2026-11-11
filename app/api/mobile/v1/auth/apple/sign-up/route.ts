import { mobileAppleSignUpBodySchema } from "@reswell/api-contract"
import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_BANNED_USER_MESSAGE } from "@/lib/messages/account-ban-errors"
import { consumeMobileSignUpRateLimit } from "@/lib/redis/rate-limit"
import { registerMobileAppleAccount } from "@/lib/services/mobileAppleSignUp"
import { isNextRequestAccessBanned } from "@/lib/services/requestAccessBan"
import { mobileDataResponse, mobileFailure, mobileTooManyRequests, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** POST `/api/mobile/v1/auth/apple/sign-up` — Apple identity token in, website sign-up side effects, session out. */
export async function POST(request: NextRequest) {
  try {
    if (await isNextRequestAccessBanned(request)) {
      return NextResponse.json({ error: ACCOUNT_BANNED_USER_MESSAGE }, { status: 403 })
    }
    const limited = await consumeMobileSignUpRateLimit(request)
    if (!limited.ok) {
      return mobileTooManyRequests(limited.retryAfterSec, "Too many sign-up attempts. Try again in a moment.")
    }

    const parsed = mobileAppleSignUpBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      )
    }

    const result = await registerMobileAppleAccount(parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/auth/apple/sign-up", error, "Couldn't create your account.")
  }
}
