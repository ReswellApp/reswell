import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { browserAuthLock } from '@/lib/supabase/browser-auth-lock'

let browserClient: SupabaseClient | undefined

/**
 * Single browser Supabase client per tab. Multiple `createBrowserClient` instances
 * contend on auth storage locks and can stall concurrent `getUser()` / `signOut()`.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  browserClient = createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
      // PKCE exchange runs on `/auth/callback` (server). Client must not consume ?code= first.
      detectSessionInUrl: false,
      // Do not use navigator.locks. A frozen Chrome tab can hold that lock
      // forever, and auth init waits on it with no timeout — login never paints.
      lock: (name, acquireTimeout, fn) =>
        browserAuthLock(name, acquireTimeout, fn),
    },
  })
  return browserClient
}
