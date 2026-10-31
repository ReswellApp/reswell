import { mobileListingReportBodySchema } from "@reswell/api-contract"
import { NextResponse } from "next/server"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { reportListingService } from "@/lib/services/mobileSafetyReport"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const listingId = z.string().uuid().safeParse(id)
    if (!listingId.success) return NextResponse.json({ error: "Invalid listing" }, { status: 400 })
    const parsed = mobileListingReportBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) {
      return mobileDataResponse(
        { ok: false, status: 400, error: "Add a short reason for the report." },
        "private, no-store",
      )
    }
    const result = await reportListingService(session.supabase, session.user, listingId.data, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/listings/[id]/report", error, "Couldn't send that report.")
  }
}
