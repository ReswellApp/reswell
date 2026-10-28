import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { markMobileListingSoldService } from "@/lib/services/mobileMyListings"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { markListingSoldBodySchema } from "@/lib/validations/mark-listing-sold"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsedId = z.string().uuid().safeParse(id)
    if (!parsedId.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid listing" }, "private, no-store")
    }
    const raw = await readMobileJson(request)
    const bodyParsed = markListingSoldBodySchema.safeParse(raw && typeof raw === "object" ? raw : {})
    if (!bodyParsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid request" }, "private, no-store")
    }
    const result = await markMobileListingSoldService(
      session.supabase,
      session.user.id,
      parsedId.data,
      bodyParsed.data,
      session.user.email,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/listings/[id]/mark-sold",
      error,
      "Unable to mark listing sold right now",
    )
  }
}
