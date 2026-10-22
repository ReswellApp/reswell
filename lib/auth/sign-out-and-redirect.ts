"use client"

import posthog from "posthog-js"
import {
  beginHeaderChromeSignOut,
  publishHeaderChromeSignedOut,
} from "@/lib/auth/header-chrome-snapshot"
import { clearSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { safeRedirectPathWithQuery } from "@/lib/auth/safe-redirect"
import { clearImpersonation } from "@/lib/impersonation"
import { clearLiveChatBrowserState } from "@/lib/live-chat/visitor-storage"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

const GLOBAL_SIGN_OUT_BUDGET_MS = 4000

/**
 * Paint guest immediately, revoke this user's refresh tokens, then leave.
 *
 * The header snapshot is display-only and is painted only while an auth cookie
 * exists. Cookies stay in place until revoke finishes: `signOut({ scope:
 * "global" })` needs the in-memory access token, and if that call does not
 * finish, `/auth/sign-out` still needs the cookies. Clearing them first makes
 * the server revoke a no-op and another tab can refresh the session back.
 */
export function signOutAndRedirect(next = "/"): void {
  if (typeof window === "undefined") return
  beginHeaderChromeSignOut()
  clearImpersonation()
  clearLiveChatBrowserState()
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
      posthog.reset()
    }
  } catch {
    // Analytics must not block sign-out.
  }
  const destination = safeRedirectPathWithQuery(next)
  void endBrowserSessionThenRedirect(destination)
}

async function endBrowserSessionThenRedirect(destination: string): Promise<void> {
  const signOutUrl = `/auth/sign-out?next=${encodeURIComponent(destination)}`
  let revoked = false
  try {
    const supabase = createClient()
    const outcome = await Promise.race([
      revokeGlobalSession(supabase),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), GLOBAL_SIGN_OUT_BUDGET_MS)
      }),
    ])
    revoked = outcome === "revoked"
  } catch {
    revoked = false
  }

  if (!revoked) {
    await paintGuestFrame()
    window.location.assign(signOutUrl)
    return
  }

  clearSupabaseAuthCookiesClient()
  publishHeaderChromeSignedOut()
  await paintGuestFrame()
  window.location.assign(destination)
}

/**
 * Revoke every refresh token for this user, then drop the local session.
 * Returns "missing" when this tab has no access token — the route handler
 * must see the cookies and revoke them.
 */
async function revokeGlobalSession(
  supabase: SupabaseClient,
): Promise<"revoked" | "missing" | "failed"> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) return "missing"
  const { error } = await supabase.auth.signOut({ scope: "global" })
  return error ? "failed" : "revoked"
}

/** `assign` freezes the document. Yield so React can commit the guest header first. */
function paintGuestFrame(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
