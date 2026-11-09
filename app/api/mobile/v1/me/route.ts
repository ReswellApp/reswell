import { NextResponse } from "next/server"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { getMobileMeService } from "@/lib/services/mobileApi"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) {
      return NextResponse.json({ error: session.error }, { status: session.status })
    }

    const result = await getMobileMeService(session.supabase, session.user)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { data: result.data },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[mobile-api] me failed", {
      route: "/api/mobile/v1/me",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load your account right now" }, { status: 500 })
  }
}
