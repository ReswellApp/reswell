import { NextResponse } from "next/server"
import { mobileSupportMediaBodySchema } from "@reswell/api-contract"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { sendMobileSupportMediaMessage } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const caseId = z.string().uuid().safeParse(id)
    if (!caseId.success) return NextResponse.json({ error: "Invalid case" }, { status: 400 })
    const body = mobileSupportMediaBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) return NextResponse.json({ error: "Invalid photo attachment" }, { status: 400 })
    const result = await sendMobileSupportMediaMessage(session.user, caseId.data, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/support/[id]/media",
      error,
      "Unable to send that photo right now",
    )
  }
}
