import { readMobileSession } from "@/lib/auth/mobile-session"
import {
  createMobileProfileAddressService,
  listMobileProfileAddressesService,
} from "@/lib/services/mobileProfileAddresses"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listMobileProfileAddressesService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/addresses", error, "Unable to load addresses right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await createMobileProfileAddressService(
      session.supabase,
      session.user.id,
      await readMobileJson(request),
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/addresses", error, "Unable to save that address")
  }
}
