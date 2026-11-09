import { NextResponse } from "next/server"
import { mobileProfileEmailSchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { changeMobileProfileEmailService } from "@/lib/services/mobileProfileSignIn"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

function accessToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  if (!header.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice("bearer ".length).trim()
  return token || null
}

/** POST `/api/mobile/v1/me/profile/email` — starts the same email-change confirmation as the website account. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const token = accessToken(request)
    if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 })
    const parsed = mobileProfileEmailSchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid email." }, { status: 400 })
    }
    const result = await changeMobileProfileEmailService(session.user, token, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/profile/email", error, "Couldn't update your email.")
  }
}
