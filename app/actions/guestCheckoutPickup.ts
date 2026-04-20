"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"

const guestPickupContactSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
})

/**
 * Persists guest pickup name on auth `user_metadata` (anonymous buyers have no shipping row for pickup).
 * Validated again in `create-payment-intent` before charging.
 */
export async function saveGuestPickupContact(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Session expired. Refresh the page and try again." }
  }

  if (!isAnonymousSupabaseUser(user)) {
    return { ok: false, error: "Pickup contact can only be saved during guest checkout." }
  }

  const body =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { full_name?: unknown })
      : {}
  const parsed = guestPickupContactSchema.safeParse({
    full_name: body.full_name,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      guest_pickup_full_name: parsed.data.full_name,
      guest_pickup_phone: null,
    },
  })

  if (error) {
    return { ok: false, error: error.message ?? "Could not save pickup details" }
  }

  return { ok: true }
}
