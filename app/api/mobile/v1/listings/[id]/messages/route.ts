import { NextRequest, NextResponse } from "next/server"
import { mobileMessageBodySchema } from "@reswell/api-contract"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { sendMobileListingMessage } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

const listingIdSchema = z.string().uuid()
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const listingId = listingIdSchema.safeParse(id)
    if (!listingId.success) return NextResponse.json({ error: "Invalid listing" }, { status: 400 })
    const body = mobileMessageBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) return NextResponse.json({ error: "Write a message first" }, { status: 400 })
    const result = await sendMobileListingMessage(session.supabase, session.user, listingId.data, body.data.body)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/listings/[id]/messages", error, "Unable to send that message right now")
  }
}
