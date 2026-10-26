import { NextResponse } from "next/server"
import { mobileSupportReplyBodySchema } from "@reswell/api-contract"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileSupportThreadService, replyMobileSupportCaseService } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const caseId = z.string().uuid().safeParse(id)
    if (!caseId.success) return NextResponse.json({ error: "Invalid case" }, { status: 400 })
    const result = await getMobileSupportThreadService(session.supabase, session.user.id, caseId.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/support/[id]", error, "Unable to load this case right now")
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const caseId = z.string().uuid().safeParse(id)
    if (!caseId.success) return NextResponse.json({ error: "Invalid case" }, { status: 400 })
    const body = mobileSupportReplyBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? "Write a message first." }, { status: 400 })
    }
    const result = await replyMobileSupportCaseService(session.supabase, session.user.id, caseId.data, body.data.body)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/support/[id]", error, "Unable to send your message right now")
  }
}
