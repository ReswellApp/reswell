import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Mark a user as active *now* for admin live stats (`profiles.last_active_at`).
 * Klaviyo inactive winback uses auth `last_sign_in_at` instead — only a new login resets that clock.
 *
 * Best-effort and non-throwing — callers fire-and-forget (`void`); a failure here
 * must never break the message/order flow.
 */
export async function touchUserLastActive(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<void> {
  const id = typeof userId === "string" ? userId.trim() : ""
  if (!id) return

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      console.warn("[user-activity] touchUserLastActive failed:", error.message)
    }
  } catch (e) {
    console.warn("[user-activity] touchUserLastActive threw:", e)
  }
}
