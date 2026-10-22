"use client"

import posthog from "posthog-js"
import { markHeaderChromeSignedOut } from "@/lib/auth/header-chrome-snapshot"
import { clearSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { clearImpersonation } from "@/lib/impersonation"
import { clearLiveChatBrowserState } from "@/lib/live-chat/visitor-storage"
import { createClient } from "@/lib/supabase/client"

const LOCAL_SIGN_OUT_BUDGET_MS = 1500

/**
 * End the browser session immediately, then revoke it on the server.
 * Client-only `signOut()` can leave cookies that middleware refreshes on the
 * next request, so `/auth/sign-out` still clears them and revokes the refresh
 * token. Local sign-out runs first so the nav can paint logged-out and an
 * in-flight token refresh cannot write the session back.
 */
export function signOutAndRedirect(next = "/"): void {
  if (typeof window === "undefined") return
  markHeaderChromeSignedOut()
  clearSupabaseAuthCookiesClient()
  clearImpersonation()
  clearLiveChatBrowserState()
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
      posthog.reset()
    }
  } catch {
    // Analytics must not block sign-out.
  }
  void endBrowserSessionThenRedirect(next)
}

async function endBrowserSessionThenRedirect(next: string): Promise<void> {
  try {
    const supabase = createClient()
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((resolve) => {
        setTimeout(resolve, LOCAL_SIGN_OUT_BUDGET_MS)
      }),
    ])
  } catch {
    // The server route still revokes the refresh token and expires cookies.
  }
  clearSupabaseAuthCookiesClient()
  // `assign` freezes the current document. Yield a task so React can paint the
  // guest header (no profile, no messages) before that frame is locked in.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  window.location.assign(`/auth/sign-out?next=${encodeURIComponent(next)}`)
}
