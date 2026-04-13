import {
  getBrowserSessionIdFromHeaders,
  supabaseAuthStorageKeyFromSessionId,
} from '@/lib/auth/browser-session'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  const cookieStore = await cookies()
  const headerList = await headers()
  const browserSessionId = getBrowserSessionIdFromHeaders((name) => headerList.get(name))
  const cookieStorageName = supabaseAuthStorageKeyFromSessionId(browserSessionId ?? undefined)

  return createServerClient(
    url,
    key,
    {
      ...(cookieStorageName ? { cookieOptions: { name: cookieStorageName } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )
}

/**
 * Anonymous `@supabase/supabase-js` client (no cookies). Use for public reads in
 * `generateStaticParams`, or whenever `cookies()` is not in scope (e.g. build time).
 * Respects RLS as the anon role.
 */
export function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  return createSupabaseClient(url, key)
}

/**
 * RLS as the user for this JWT — use when the session cookie is not on the request yet
 * (e.g. immediately after `signUp` before the browser persists SSR auth cookies).
 */
export function createUserJwtSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  return createSupabaseClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })
}

/**
 * Service role client for server-only use (e.g. webhooks). Bypasses RLS.
 * Only use when no user session is available.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createSupabaseClient(url, key)
}
