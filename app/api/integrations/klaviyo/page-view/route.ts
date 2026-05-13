import { NextRequest, NextResponse } from "next/server"
import { klaviyoPageViewBodySchema } from "@/lib/validations/klaviyoPageView"
import { trackKlaviyoPageView } from "@/lib/services/klaviyoPageView"
import { recordSiteTrafficPageViewEvent } from "@/lib/services/siteTraffic"
import { createClient } from "@/lib/supabase/server"

/**
 * Client-side navigation + first-load page views → Klaviyo Events API.
 * `/admin` requests are skipped (no metric). Metrics: **Viewed Sell Page**, **Viewed Boards Page**, **Viewed Site Page** (see `trackKlaviyoPageView`).
 */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = klaviyoPageViewBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data.pathname.trim()
  if (p === "/admin" || p.startsWith("/admin/")) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !parsed.data.anonymous_id?.trim()) {
    return NextResponse.json(
      { error: "anonymous_id required when logged out" },
      { status: 400 },
    )
  }

  try {
    await Promise.all([
      trackKlaviyoPageView({
        pathname: parsed.data.pathname,
        search: parsed.data.search,
        anonymousId: parsed.data.anonymous_id ?? null,
        loggedInUserId: user?.id ?? null,
        loggedInUserEmail: user?.email ?? null,
      }),
      recordSiteTrafficPageViewEvent({
        pathname: parsed.data.pathname,
        anonymousId: parsed.data.anonymous_id ?? null,
        loggedInUserId: user?.id ?? null,
      }),
    ])
  } catch (e) {
    console.error("[klaviyo] page-view:", e)
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
