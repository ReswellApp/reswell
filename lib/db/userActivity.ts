import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Mark a user as active *now* by moving `profiles.last_active_at` forward.
 *
 * Presence heartbeats already cover signed-in users with the site open, but
 * meaningful server-side engagement (sending a message, completing a purchase)
 * should also reset the inactivity clock. Moving `last_active_at` forward is what
 * makes Klaviyo inactive-milestone re-entry work: a fresh timestamp invalidates
 * any previously recorded milestone for the next inactivity streak.
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
