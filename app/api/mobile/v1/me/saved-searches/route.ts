import { mobileSavedSearchBodySchema, mobileSavedSearchQuerySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import {
  getMobileSavedSearchService,
  setMobileSavedSearchService,
} from "@/lib/services/mobileSavedSearch"
import { mobileDataResponse, mobileFailure, readMobileJson } from "@/lib/utils/mobile-api-response"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileSavedSearchQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) return NextResponse.json({ error: "Invalid search query" }, { status: 400 })
    const result = await getMobileSavedSearchService(session.supabase, session.user.id, parsed.data.q)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/saved-searches", error, "Unable to load saved searches right now")
  }
}

export async function POST(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")
    const parsed = mobileSavedSearchBodySchema.safeParse(await readMobileJson(request))
    if (!parsed.success) return NextResponse.json({ error: "Invalid saved search" }, { status: 400 })
    const result = await setMobileSavedSearchService(
      session.supabase,
      session.user,
      parsed.data.q,
      parsed.data.saved,
    )
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/saved-searches", error, "Unable to update this saved search right now")
  }
}
