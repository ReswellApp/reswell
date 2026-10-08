import { NextRequest, NextResponse } from "next/server"
import { mobileOfferActionBodySchema } from "@reswell/api-contract"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { actOnMobileOffer } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const offerId = z.string().uuid().safeParse(id)
    if (!offerId.success) return NextResponse.json({ error: "Invalid offer" }, { status: 400 })
    const body = mobileOfferActionBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      const message = body.error.issues[0]?.message ?? "Invalid offer action"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const result = await actOnMobileOffer(session.supabase, session.user.id, offerId.data, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/offers/[id]", error, "Unable to update this offer right now")
  }
}
