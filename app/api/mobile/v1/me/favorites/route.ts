import { mobileFavoriteBodySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { listMobileFavoritesService } from "@/lib/services/mobileAccountApi"
import { setMobileFavorite } from "@/lib/services/mobileMutations"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const result = await listMobileFavoritesService(session.supabase, session.user.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/favorites", error, "Unable to load favorites right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileFavoriteBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) return NextResponse.json({ error: "Invalid favorite" }, { status: 400 })
    const result = await setMobileFavorite(
      session.supabase,
      session.user,
      parsed.data.listing_id,
      parsed.data.favorited,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/favorites", error, "Unable to update this favorite right now")
  }
}
