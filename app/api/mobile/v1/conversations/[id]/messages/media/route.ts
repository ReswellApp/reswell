import { NextRequest, NextResponse } from "next/server"
import { mobileConversationParamSchema, mobileMessageMediaBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { sendMobileConversationMediaMessage } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const params = mobileConversationParamSchema.safeParse({ id })
    if (!params.success) return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
    const body = mobileMessageMediaBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) return NextResponse.json({ error: "Invalid photo attachment" }, { status: 400 })
    const result = await sendMobileConversationMediaMessage(
      session.supabase,
      session.user,
      params.data.id,
      body.data,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/conversations/[id]/messages/media",
      error,
      "Unable to send that photo right now",
    )
  }
}
