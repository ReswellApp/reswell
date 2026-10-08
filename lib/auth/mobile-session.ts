import { createUserJwtSupabaseClient } from "@/lib/supabase/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export type MobileSession =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; status: 401; error: string }

/**
 * App sessions are Supabase access tokens, not the website's cookies.
 * The Expo app signs in with Supabase directly and sends `Authorization: Bearer`.
 */
export async function readMobileSession(request: Request): Promise<MobileSession> {
  const header = request.headers.get("authorization")
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Sign in required" }
  }

  const accessToken = header.slice("bearer ".length).trim()
  if (!accessToken) {
    return { ok: false, status: 401, error: "Sign in required" }
  }

  try {
    const supabase = createUserJwtSupabaseClient(accessToken)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return { ok: false, status: 401, error: "Sign in required" }
    }
    return { ok: true, user: data.user, supabase }
  } catch (error) {
    console.error("[mobile-api] bearer auth failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, status: 401, error: "Sign in required" }
  }
}
