import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  clearSupabaseAuthCookies,
  clearSupabaseAuthCookiesFromStore,
  isInvalidRefreshTokenError,
} from '@/lib/auth/clear-supabase-auth-cookies'
import { createClient } from '@/lib/supabase/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client'

export type SafeServerUserResult = {
  user: User | null
  /** Dead refresh token — caller should clear auth cookies on the response. */
  staleSession: boolean
}

/**
 * Session-safe wrapper around `supabase.auth.getUser()`.
 * Treats stale refresh tokens as logged-out instead of throwing or logging 500s.
 */
export async function getSafeServerUser(
  supabase: SupabaseClient,
): Promise<SafeServerUserResult> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      return { user: null, staleSession: isInvalidRefreshTokenError(error) }
    }

    return { user: user ?? null, staleSession: false }
  } catch (error) {
    return { user: null, staleSession: isInvalidRefreshTokenError(error) }
  }
}

/** Purge dead Supabase auth cookies from the current request's cookie store. */
export async function clearStaleSupabaseAuthCookies(): Promise<void> {
  try {
    const cookieStore = await cookies()
    clearSupabaseAuthCookiesFromStore(cookieStore)
  } catch {
    // Route Handlers can write cookies; Server Components may not — ignore.
  }
}

/**
 * Creates the SSR Supabase client and resolves the current user without throwing
 * on `refresh_token_not_found`. Clears stale auth cookies when needed.
 */
export async function resolveServerAuth(): Promise<{
  supabase: SupabaseClient
  user: User | null
}> {
  const supabase = await createClient()
  const { user, staleSession } = await getSafeServerUser(supabase)
  if (staleSession) {
    await clearStaleSupabaseAuthCookies()
  }
  return { supabase, user }
}

/**
 * Route Handler variant: reads/writes cookies on the outgoing response (OAuth, session probe).
 */
export async function getSafeRouteUser(
  request: NextRequest,
  response: NextResponse,
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const supabase = createRouteHandlerSupabaseClient(request, response)
  const { user, staleSession } = await getSafeServerUser(supabase)
  if (staleSession) {
    clearSupabaseAuthCookies(request, response)
  }
  return { supabase, user }
}
