import {
  parseBrowserSessionRoute,
  supabaseAuthStorageKeyFromSessionId,
} from '@/lib/auth/browser-session'
import { createBrowserClient } from '@supabase/ssr'

let cachedStorageKey: string | null = null
let cachedClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  const sessionId =
    typeof window !== 'undefined'
      ? parseBrowserSessionRoute(window.location.pathname)?.sessionId
      : undefined
  const storageName = supabaseAuthStorageKeyFromSessionId(sessionId)
  const cacheKey = storageName ?? 'default'

  if (cachedClient && cachedStorageKey === cacheKey) {
    return cachedClient
  }

  const client = createBrowserClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
    isSingleton: false,
    ...(storageName ? { cookieOptions: { name: storageName } } : {}),
  })

  cachedStorageKey = cacheKey
  cachedClient = client
  return client
}
