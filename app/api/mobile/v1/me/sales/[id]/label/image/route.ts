import { NextResponse } from "next/server"
import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileSaleLabelImageService } from "@/lib/services/mobileSaleLabel"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid sale" }, "private, no-store")
    }
    const result = await getMobileSaleLabelImageService(session.supabase, session.user.id, parsed.data)
    if (!result.ok) return mobileDataResponse(result, "private, no-store")
    return new NextResponse(Buffer.from(result.data.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.data.contentType,
        "Cache-Control": "private, max-age=120",
      },
    })
  } catch (error) {
    return mobileFailure(
      "/api/mobile/v1/me/sales/[id]/label/image",
      error,
      "Unable to open the shipping label right now",
    )
  }
}
