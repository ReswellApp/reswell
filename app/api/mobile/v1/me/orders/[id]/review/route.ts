import { z } from "zod"
import { mobileOrderReviewBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { submitMobileOrderReviewService } from "@/lib/services/mobileOrderReview"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsedId = z.string().uuid().safeParse(id)
    if (!parsedId.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid order" }, "private, no-store")
    }
    const raw = await readMobileJson(request)
    const bodyParsed = mobileOrderReviewBodySchema.safeParse(raw && typeof raw === "object" ? raw : {})
    if (!bodyParsed.success) {
      return mobileDataResponse(
        { ok: false, status: 400, error: "Choose a rating from 1 to 5" },
        "private, no-store",
      )
    }
    const result = await submitMobileOrderReviewService(
      session.supabase,
      session.user.id,
      parsedId.data,
      bodyParsed.data,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/orders/[id]/review",
      error,
      "Unable to save your review right now",
    )
  }
}
