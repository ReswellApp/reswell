import { mobileShipperActionBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { actOnMobileShipperService, getMobileShipperService } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileShipperService(session.supabase)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/shipper", error, "Unable to load Shipper right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const body = mobileShipperActionBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid Shipper update" }, { status: 400 })
    }
    const result = await actOnMobileShipperService(session.supabase, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/shipper", error, "Unable to update Shipper right now")
  }
}
