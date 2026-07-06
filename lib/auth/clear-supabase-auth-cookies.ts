import type { NextRequest, NextResponse } from 'next/server'
import { isTransientNetworkError } from '@/lib/utils/transient-network-retry'

/** Matches Supabase SSR auth cookies, including chunked variants (`sb-<ref>-auth-token.0`). */
function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') && name.includes('auth-token')
}

type WritableCookieStore = {
  getAll(): { name: string }[]
  set(name: string, value: string, options?: { maxAge?: number; path?: string }): void
}

/** Clears stale Supabase auth cookies from a Next.js `cookies()` store (Route Handlers / Actions). */
export function clearSupabaseAuthCookiesFromStore(store: WritableCookieStore): void {
  for (const { name } of store.getAll()) {
    if (!isSupabaseAuthCookie(name)) continue
    store.set(name, '', { maxAge: 0, path: '/' })
  }
}

/**
 * Removes stale Supabase auth cookies from both the request and the outgoing
 * response. Call this when a refresh token is rejected (`refresh_token_not_found`
 * / `invalid_refresh_token`) so the browser stops replaying a dead session on
 * every subsequent request — otherwise the failed refresh repeats indefinitely.
 */
export function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  for (const { name } of request.cookies.getAll()) {
    if (!isSupabaseAuthCookie(name)) continue
    request.cookies.delete(name)
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
}

/** True when an error from `supabase.auth.getUser()` means the refresh token is dead. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return (
    code === 'refresh_token_not_found' || code === 'invalid_refresh_token'
  )
}

/** True when there is no session yet (e.g. OAuth callback before code exchange). */
export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return name === 'AuthSessionMissingError'
}

/**
 * Errors from `getUser()` that mean "treat as logged out" — not a server failure.
 * OAuth/email token exchange routes must not throw on these before session cookies exist.
 */
export function isBenignAuthSessionError(error: unknown): boolean {
  return (
    isInvalidRefreshTokenError(error) || isAuthSessionMissingError(error)
  )
}

/** GoTrue 500 when Postgres/auth is degraded (e.g. connection pool exhausted). */
export function isAuthServiceDegradedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'unexpected_failure'
}

/** Transient reachability failures (`AuthRetryableFetchError`, undici "fetch failed"). */
export function isTransientAuthNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  if (name === 'AuthRetryableFetchError') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && isTransientNetworkError(message)
}

/**
 * Session lookup errors that must not 500 middleware — treat as logged-out and continue.
 */
export function isNonFatalGetUserError(error: unknown): boolean {
  return (
    isBenignAuthSessionError(error) ||
    isTransientAuthNetworkError(error) ||
    isAuthServiceDegradedError(error)
  )
}
