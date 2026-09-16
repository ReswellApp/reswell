import type { User } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { clearSupabaseAuthCookies } from "@/lib/auth/clear-supabase-auth-cookies"
import { fetchUserRestrictionState } from "@/lib/db/accountRestrictions"
import {
  ACCOUNT_BANNED_ERROR,
  isPermanentRestrictionUntil,
  isUserAuthBanned,
} from "@/lib/messages/account-ban-errors"
import { createServiceRoleClient } from "@/lib/supabase/server"

/** Redirect a banned user back to login and drop any session cookies from this response. */
export function bannedAuthRedirect(request: NextRequest, origin: string): NextResponse {
  const url = new URL("/auth/login", origin)
  url.searchParams.set("error", ACCOUNT_BANNED_ERROR)
  const response = NextResponse.redirect(url)
  clearSupabaseAuthCookies(request, response)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

/**
 * True when this auth user is permanently banned.
 * Checks the JWT first (`banned_until` / `app_metadata.banned`), then the
 * profile restriction we always write on ban — so Google OAuth cannot skip it.
 */
export async function shouldRejectBannedAuthUser(user: User | null | undefined): Promise<boolean> {
  if (!user) return false
  if (isUserAuthBanned(user)) return true

  try {
    const service = createServiceRoleClient()
    const state = await fetchUserRestrictionState(service, user.id)
    return isPermanentRestrictionUntil(state?.accountRestrictedUntil)
  } catch {
    return false
  }
}
