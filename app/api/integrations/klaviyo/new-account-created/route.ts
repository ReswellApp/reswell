import type { SupabaseClient, User } from "@supabase/supabase-js"

import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created"
import {
  createAnonSupabaseClient,
  createClient,
  createUserJwtSupabaseClient,
} from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Called after email/password sign-up when Supabase returns an immediate session
 * (normal when “Confirm email” is off). OAuth still uses `/auth/callback`; optional
 * confirm-email flows use `/auth/confirm`.
 *
 * Clients should send `Authorization: Bearer <access_token>` from `signUp`’s session;
 * cookie-only auth often is not available on this first request yet (PKCE / SSR timing).
 */
export async function POST(request: NextRequest) {
  const bearerRaw = request.headers.get("authorization")
  const bearer =
    bearerRaw?.startsWith("Bearer ") ? bearerRaw.slice(7).trim() : ""

  let user: User | null = null
  let supabaseForProfile: SupabaseClient | null = null

  if (bearer) {
    const anon = createAnonSupabaseClient()
    const { data, error } = await anon.auth.getUser(bearer)
    if (!error && data.user) {
      user = data.user
      supabaseForProfile = createUserJwtSupabaseClient(bearer)
    }
  }

  if (!user) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
    supabaseForProfile = supabase
  }

  if (!user) {
    console.warn(
      "[klaviyo] new-account-created: unauthorized (no valid Bearer token or session cookie)",
    )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await trackKlaviyoNewAccountCreated(user, {
    supabaseForProfile: supabaseForProfile ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
