import type { SupabaseClient, User } from "@supabase/supabase-js"

const BASE_DELAY_MS = 280

export type GetUserWithRetryResult =
  | { ok: true; user: User | null }
  | { ok: false; error: Error }

/**
 * Client-side `getUser()` hits the network; transient failures should not paint
 * a logged-out header when SSR/middleware already accepted the session.
 */
export async function getAuthUserWithRetry(
  supabase: SupabaseClient,
  options?: { attempts?: number },
): Promise<GetUserWithRetryResult> {
  const attempts = Math.max(1, options?.attempts ?? 3)
  let lastError: Error | null = null

  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        throw error
      }
      return { ok: true, user: data.user }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * (i + 1)))
      }
    }
  }

  return { ok: false, error: lastError ?? new Error("getUser failed") }
}
