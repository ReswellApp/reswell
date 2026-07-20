import { createClient } from "@/lib/supabase/server"
import { touchUserLastActive } from "@/lib/db/userActivity"

export type PresenceHeartbeatResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error?: string }

/**
 * Best-effort presence ping for admin live stats (`profiles.last_active_at`).
 * Does not affect Klaviyo inactivity (that uses auth last_sign_in_at).
 */
export async function recordPresenceHeartbeat(): Promise<PresenceHeartbeatResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401 }
  }

  try {
    await touchUserLastActive(supabase, user.id)
    return { ok: true }
  } catch (error) {
    console.warn("[presence] recordPresenceHeartbeat failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, status: 500, error: "Failed to update presence" }
  }
}
