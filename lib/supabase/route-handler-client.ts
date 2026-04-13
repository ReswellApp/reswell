import {
  getBrowserSessionIdFromHeaders,
  supabaseAuthStorageKeyFromSessionId,
} from '@/lib/auth/browser-session'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase client for Route Handlers: reads cookies from the request and writes
 * session cookies onto the outgoing response (e.g. redirect after OAuth).
 * Do not use the Server Component client here — its setAll try/catch can drop
 * cookies that must be attached to this response.
 */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse,
  options?: { browserSessionId?: string | null },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }
  const browserSessionId =
    options?.browserSessionId ??
    getBrowserSessionIdFromHeaders((name) => request.headers.get(name))
  const cookieStorageName = supabaseAuthStorageKeyFromSessionId(browserSessionId ?? undefined)

  return createServerClient(url, key, {
    ...(cookieStorageName ? { cookieOptions: { name: cookieStorageName } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
}
