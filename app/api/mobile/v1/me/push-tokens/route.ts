import { mobilePushTokenBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { deleteMobilePushTokenService, registerMobilePushTokenService } from "@/lib/services/mobilePushTokens"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const body = mobilePushTokenBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Check the device token." },
        { status: 400 },
      )
    }
    const result = await registerMobilePushTokenService(session.user.id, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/push-tokens", error, "Unable to save this device right now")
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const body = mobilePushTokenBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Check the device token." },
        { status: 400 },
      )
    }
    const result = await deleteMobilePushTokenService(session.user.id, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/push-tokens", error, "Unable to remove this device right now")
  }
}
