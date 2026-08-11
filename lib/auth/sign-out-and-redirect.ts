"use client"

import { clearImpersonation } from "@/lib/impersonation"
import { postSignOutLoginHref } from "@/lib/auth/post-sign-out-login-href"
import { clearLiveChatBrowserState } from "@/lib/live-chat/visitor-storage"

/**
 * End the Supabase session server-side (clears SSR auth cookies), then redirect.
 * Client-only `signOut()` can leave cookies that middleware refreshes on the next request.
 */
export function signOutAndRedirect(next?: string): void {
  if (typeof window === "undefined") return
  clearImpersonation()
  // Live chat resume keys live in localStorage and are not auth cookies.
  clearLiveChatBrowserState()
  const destination = next ?? postSignOutLoginHref()
  window.location.assign(`/auth/sign-out?next=${encodeURIComponent(destination)}`)
}
