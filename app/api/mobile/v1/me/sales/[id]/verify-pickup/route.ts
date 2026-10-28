import { z } from "zod"
import { mobileSaleVerifyPickupBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { verifyMobileSalePickupService } from "@/lib/services/mobileSales"
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
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid sale" }, "private, no-store")
    }
    const raw = await readMobileJson(request)
    const bodyParsed = mobileSaleVerifyPickupBodySchema.safeParse(raw && typeof raw === "object" ? raw : {})
    if (!bodyParsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Pickup code is required" }, "private, no-store")
    }
    const result = await verifyMobileSalePickupService(
      session.supabase,
      session.user.id,
      parsedId.data,
      bodyParsed.data.code,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/sales/[id]/verify-pickup",
      error,
      "Unable to verify pickup right now",
    )
  }
}
