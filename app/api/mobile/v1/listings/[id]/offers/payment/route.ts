import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { createMobileListingOfferPayment } from "@/lib/services/mobileListingOffers"
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
    const result = await createMobileListingOfferPayment(
      session.supabase,
      session.user,
      listingId.data,
      await readMobileJson(request),
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/listings/[id]/offers/payment",
      error,
      "Unable to start offer payment right now",
    )
  }
}
