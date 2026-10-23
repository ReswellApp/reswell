import { NextResponse } from "next/server"
import { mobileShopifyActionBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { actOnMobileShopifyService, getMobileShopifyService } from "@/lib/services/mobileDashboardSections"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await getMobileShopifyService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/shopify", error, "Unable to load Shopify right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const body = mobileShopifyActionBodySchema.safeParse(await readMobileJson(request))
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid Shopify update" }, { status: 400 })
    }
    const result = await actOnMobileShopifyService(session.supabase, session.user.id, body.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/shopify", error, "Unable to update Shopify right now")
  }
}
