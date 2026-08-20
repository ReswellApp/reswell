"use client"

import posthog from "posthog-js"
import { clearImpersonation } from "@/lib/impersonation"
import { postSignOutLoginHref } from "@/lib/auth/post-sign-out-login-href"

/**
 * End the Supabase session server-side (clears SSR auth cookies), then redirect.
 * Client-only `signOut()` can leave cookies that middleware refreshes on the next request.
 */
export function signOutAndRedirect(next?: string): void {
  if (typeof window === "undefined") return
  if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    posthog.reset()
  }
  clearImpersonation()
  const destination = next ?? postSignOutLoginHref()
  window.location.assign(`/auth/sign-out?next=${encodeURIComponent(destination)}`)
}
