import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileListingEditService, updateMobileListingEditService } from "@/lib/services/mobileSellEdit"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing" }, "private, no-store")
    }
    const result = await getMobileListingEditService(session.supabase, session.user.id, parsed.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/listings/[id]/edit", error, "Unable to load listing for edit")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsedId = z.string().uuid().safeParse(id)
    if (!parsedId.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing" }, "private, no-store")
    }
    const raw = await readMobileJson(request)
    if (!raw || typeof raw !== "object") {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing update" }, "private, no-store")
    }
    const body = { ...(raw as Record<string, unknown>), listing_id: parsedId.data }
    const result = await updateMobileListingEditService(session.supabase, session.user.id, body)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/listings/[id]/edit", error, "Unable to save listing changes")
  }
}
