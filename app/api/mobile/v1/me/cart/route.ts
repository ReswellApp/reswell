import { NextResponse } from "next/server"
import { mobileCartBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileCartService } from "@/lib/services/mobileAccountApi"
import { setMobileCartItem } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileCartService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/cart", error, "Unable to load your cart right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileCartBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) return NextResponse.json({ error: "Invalid cart item" }, { status: 400 })
    const result = await setMobileCartItem(
      session.supabase,
      session.user,
      parsed.data.listing_id,
      parsed.data.quantity,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/cart", error, "Unable to update your cart right now")
  }
}
