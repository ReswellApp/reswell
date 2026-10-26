import { NextResponse } from "next/server"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileBalanceSheetService } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const page = Number(new URL(request.url).searchParams.get("page") ?? "1")
    if (!Number.isInteger(page) || page < 1 || page > 100) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 })
    }
    const result = await getMobileBalanceSheetService(session.supabase, session.user.id, page)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/balance-sheet", error, "Unable to load the balance sheet right now")
  }
}
