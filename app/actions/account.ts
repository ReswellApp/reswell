"use server"

import { createClient } from "@/lib/supabase/server"
import { submitContactFormMessageService } from "@/lib/services/contactForm"
import { recordPresenceHeartbeat } from "@/lib/services/presenceHeartbeat"

export async function getAdminSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { isAdmin: false }
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  return { isAdmin: profile?.is_admin === true }
}

export async function getPaypalProfileStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const, data: {} }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("paypal_email, paypal_display_name, paypal_payer_id, paypal_connected_at")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    return { error: error.message, data: {} }
  }

  return { data: data ?? {}, error: null }
}

/** Prefer POST /api/presence/heartbeat from clients — avoids deploy-skew Server Action 404s. */
export async function updatePresenceHeartbeat() {
  const result = await recordPresenceHeartbeat()
  if (!result.ok) {
    return { ok: false as const, error: result.error }
  }
  return { ok: true as const }
}

export async function submitContactMessage(input: { name: string; email: string; message: string }) {
  const result = await submitContactFormMessageService(input)
  if ("error" in result) {
    return { error: result.error }
  }
  return { success: true as const, ticketId: result.ticketId }
}
