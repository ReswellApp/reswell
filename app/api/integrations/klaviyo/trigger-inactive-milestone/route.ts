import "@/lib/klaviyo/bootstrap-env"
import {
  inactivityMilestoneTiersUpTo,
  recordKlaviyoInactivityMilestonesSent,
} from "@/lib/db/klaviyoInactivityMilestones"
import { fetchProfileLastSignInAnchor } from "@/lib/db/profileLastSignIn"
import { fetchRecentPublicListingsPoolForKlaviyo } from "@/lib/db/recentPublicListingsForKlaviyo"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { pickFeaturedListingsForInactiveUser } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  INACTIVE_MILESTONE_METRIC_NAMES,
  trackKlaviyoUserInactiveMilestone,
} from "@/lib/klaviyo/track-user-inactive-milestone"
import { klaviyoTriggerInactiveMilestoneBodySchema } from "@/lib/validations/klaviyoTriggerInactiveMilestone"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Manually emit **User Inactive 30 Days** for one profile (Klaviyo Events API).
 * Protect with `CRON_SECRET` when set (`Authorization: Bearer …`), same pattern as other cron routes.
 *
 * Testing: send `"dedupe_nonce": "manual-1730000000"` so Klaviyo does not dedupe repeat requests.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = klaviyoTriggerInactiveMilestoneBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const { user_id, milestone_days, record_milestone, dedupe_nonce } = parsed.data

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", user_id)
    .maybeSingle()

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  let email = typeof profile.email === "string" && profile.email.trim() ? profile.email.trim() : null
  if (!email) {
    email = await getAuthEmailForUserId(user_id)
  }

  const poolRes = await fetchRecentPublicListingsPoolForKlaviyo(supabase)
  if (poolRes.error) {
    console.error("[klaviyo] trigger-inactive-milestone: listing pool:", poolRes.error)
  }

  const { iso: lastIso, error: signInErr } = await fetchProfileLastSignInAnchor(
    supabase,
    user_id,
  )
  if (!lastIso) {
    return NextResponse.json(
      { error: signInErr ?? "No sign-in timestamp for user" },
      { status: 400 },
    )
  }

  const result = await trackKlaviyoUserInactiveMilestone({
    userId: user_id,
    email,
    displayName: profile.display_name,
    milestoneDays: milestone_days,
    lastActiveAtIso: lastIso,
    featuredListings: pickFeaturedListingsForInactiveUser(poolRes.data, user_id),
    uniqueIdSuffix: dedupe_nonce,
  })

  let recorded: boolean | null = null
  let recordError: string | null = null

  if (record_milestone && result.ok) {
    const ins = await recordKlaviyoInactivityMilestonesSent(
      supabase,
      user_id,
      inactivityMilestoneTiersUpTo(milestone_days),
    )
    recorded = !ins.error
    recordError = ins.error ?? null
  }

  return NextResponse.json({
    metric_name: INACTIVE_MILESTONE_METRIC_NAMES[milestone_days],
    klaviyo: {
      ok: result.ok,
      skipped: result.skipped,
      status: result.status,
      skip_reason: result.skipReason ?? null,
      detail: result.detail,
    },
    record_milestone,
    milestone_recorded: recorded,
    record_error: recordError,
  })
}
