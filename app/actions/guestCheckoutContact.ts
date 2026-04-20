"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"

const emailSchema = z.string().trim().email("Enter a valid email address").max(320)

/**
 * Persists guest checkout email on `profiles.email` for anonymous buyers
 * (auth email is empty until they link Google / sign up).
 */
export async function saveGuestCheckoutContactEmail(
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
    return { ok: false, error: "Guest email can only be saved during guest checkout." }
  }

  const emailRaw =
    raw && typeof raw === "object" && !Array.isArray(raw) && "email" in raw
      ? (raw as { email: unknown }).email
      : raw
  const parsed = emailSchema.safeParse(emailRaw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" }
  }

  const email = parsed.data

  const { error } = await supabase.from("profiles").update({ email }).eq("id", user.id)

  if (error) {
    return { ok: false, error: error.message ?? "Could not save email" }
  }

  return { ok: true }
}
