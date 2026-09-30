import { NextRequest, NextResponse } from "next/server"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import { pageViewRequiresUserLookup } from "@/lib/klaviyo/page-view-metric"
import { klaviyoPageViewBodySchema } from "@/lib/validations/klaviyoPageView"
import { trackKlaviyoPageView } from "@/lib/services/klaviyoPageView"
import { recordSiteTrafficPageViewEvent } from "@/lib/services/siteTraffic"
import { createClient } from "@/lib/supabase/server"

/**
 * Client-side navigation + first-load page views → Klaviyo Events API.
 * `/admin` sends no metric. Listing pages (`/l/{slug}`) send **Viewed Product** for the signed-in session only.
 * Browse paths, including `/boards` and `/fins`, send **Viewed Site Page**. `/sell` sends **Viewed Sell Page**.
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

  const shouldLookUpUser = pageViewRequiresUserLookup(
    p,
    hasSupabaseAuthCookies(request.cookies.getAll()),
  )
  const supabase = shouldLookUpUser ? await createClient() : undefined
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null

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
        supabase,
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
