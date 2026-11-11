import { z } from "zod"
import { readMobileSession } from "@/lib/auth/mobile-session"
import {
  deleteMobileProfileAddressService,
  updateMobileProfileAddressService,
} from "@/lib/services/mobileProfileAddresses"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function invalidAddress() {
  return mobileDataResponse({ ok: false, status: 400, error: "Missing address id" }, "private, no-store")
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const addressId = z.string().uuid().safeParse(id)
    if (!addressId.success) return invalidAddress()
    const result = await updateMobileProfileAddressService(
      session.supabase,
      session.user.id,
      addressId.data,
      await readMobileJson(request),
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/addresses/[id]", error, "Unable to save that address")
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const { id } = await context.params
    const addressId = z.string().uuid().safeParse(id)
    if (!addressId.success) return invalidAddress()
    const result = await deleteMobileProfileAddressService(session.supabase, session.user.id, addressId.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/addresses/[id]", error, "Unable to delete that address")
  }
}
