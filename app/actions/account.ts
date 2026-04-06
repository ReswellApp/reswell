"use server"

import { createClient } from "@/lib/supabase/server"

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

export async function updatePresenceHeartbeat() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const }
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from("profiles").update({ last_active_at: now }).eq("id", user.id)

  if (error) {
    return { ok: false as const, error: "Failed to update presence" }
  }

  return { ok: true as const }
}

export async function submitContactMessage(input: { name: string; email: string; message: string }) {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const message = typeof input.message === "string" ? input.message.trim() : ""

  if (!name || !email || !message) {
    return { error: "Name, email, and message are required" as const }
  }

  if (message.length > 10000) {
    return { error: "Message is too long" as const }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("contact_messages").insert({
    name,
    email,
    message,
  })

  if (error) {
    console.error("Contact form insert error:", error)
    return { error: "Failed to send message" as const }
  }

  return { success: true as const }
}
