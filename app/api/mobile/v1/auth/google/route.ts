import { NextRequest, NextResponse } from "next/server"
import { mobileGoogleAuthorizeTarget } from "@/lib/auth/mobile-google-handoff"
import { supabasePrimaryRestUrl } from "@/lib/supabase/rest-url"

export const dynamic = "force-dynamic"

/**
 * iOS shows the host of the URL that starts sign-in. The app opens this
 * Reswell route, which forwards only to our Supabase Google authorize URL.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "Missing sign-in URL" }, { status: 400 })
  }

  let supabaseUrl: string
  try {
    supabaseUrl = supabasePrimaryRestUrl()
  } catch (error) {
    console.error("[mobile-auth] google handoff unavailable", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Sign-in is unavailable" }, { status: 500 })
  }

  const target = mobileGoogleAuthorizeTarget(supabaseUrl, raw)
  if (!target) {
    return NextResponse.json({ error: "Invalid sign-in URL" }, { status: 400 })
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  })
}
