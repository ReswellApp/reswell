import { mobileSignUpBodySchema } from "@reswell/api-contract"
import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_BANNED_USER_MESSAGE } from "@/lib/messages/account-ban-errors"
import { registerMobileEmailAccount } from "@/lib/services/mobileEmailSignUp"
import { isNextRequestAccessBanned } from "@/lib/services/requestAccessBan"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** POST `/api/mobile/v1/auth/sign-up` — website email sign-up rules, session returned to the app. */
export async function POST(request: NextRequest) {
  try {
    if (await isNextRequestAccessBanned(request)) {
      return NextResponse.json({ error: ACCOUNT_BANNED_USER_MESSAGE }, { status: 403 })
    }

    const parsed = mobileSignUpBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      )
    }

    const result = await registerMobileEmailAccount(parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/auth/sign-up", error, "Couldn't create your account.")
  }
}
