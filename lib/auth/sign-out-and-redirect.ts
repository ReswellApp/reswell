"use client"

import posthog from "posthog-js"
import { clearImpersonation } from "@/lib/impersonation"
import { clearLiveChatBrowserState } from "@/lib/live-chat/visitor-storage"

/**
 * End the Supabase session server-side (clears SSR auth cookies), then redirect.
 * Client-only `signOut()` can leave cookies that middleware refreshes on the next request.
 */
export function signOutAndRedirect(next = "/"): void {
  if (typeof window === "undefined") return
  if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    posthog.reset()
  }
  clearImpersonation()
  // Live chat resume keys live in localStorage and are not auth cookies.
  clearLiveChatBrowserState()
  window.location.assign(`/auth/sign-out?next=${encodeURIComponent(next)}`)
}
