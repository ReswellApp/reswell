import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const ANON_COOKIE = "kv_anon_id"
const ANON_MAX_AGE = 60 * 60 * 24 * 400

/**
 * Fires a lightweight "Viewed Page" metric on navigation (same private API key as listing events).
 * Logged-in: profile uses Supabase user id + email. Anonymous: stable `anonymous_id` in a cookie.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let body: { path?: string; href?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 2000) : ""
  const href = typeof body.href === "string" ? body.href.slice(0, 4000) : ""

  const cookieStore = await cookies()
  let anonymousId = cookieStore.get(ANON_COOKIE)?.value?.trim() || ""

  const profile: {
    external_id?: string
    email?: string | null
    anonymous_id?: string
  } = {}

  if (user) {
    profile.external_id = user.id
    profile.email = user.email ?? null
  } else {
    if (!anonymousId) {
      anonymousId = crypto.randomUUID()
    }
    profile.anonymous_id = anonymousId
  }

  const result = await sendKlaviyoServerEvent({
    metricName: "Viewed Page",
    properties: {
      Path: path || "/",
      URL: href || "",
    },
    profile,
    uniqueId: `pv-${user?.id ?? anonymousId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  })

  const res = NextResponse.json({
    ok: result.ok,
    skipped: result.skipped,
    status: result.status,
  })

  if (!user && anonymousId && !cookieStore.get(ANON_COOKIE)?.value) {
    res.cookies.set(ANON_COOKIE, anonymousId, {
      path: "/",
      maxAge: ANON_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return res
}
