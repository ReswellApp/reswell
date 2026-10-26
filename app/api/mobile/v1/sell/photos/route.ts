import { NextResponse } from "next/server"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { uploadMobileSellPhotoService } from "@/lib/services/mobileSellPublish"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** POST `/api/mobile/v1/sell/photos` — one listing photo, stored on the seller's account. */
export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo" }, { status: 400 })
    }
    const result = await uploadMobileSellPhotoService(session.supabase, session.user.id, file)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/photos", error, "Couldn't upload that photo")
  }
}
