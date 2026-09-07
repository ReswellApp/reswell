import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

async function resolveAddressPhoneE164(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("addresses")
    .select("phone")
    .eq("profile_id", userId)
    .not("phone", "is", null)
    .order("is_default", { ascending: false })
    .limit(8)

  if (error) {
    console.error("[messageSmsNotifications] address phone:", error)
    return null
  }

  for (const row of data ?? []) {
    const phone = typeof row.phone === "string" ? toE164UsPhone(row.phone) : null
    if (phone) return phone
  }

  return null
}

export type MessageSmsNotificationPrefs = {
  message_sms_opt_in: boolean
}

export async function getMessageSmsOptInForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("message_sms_opt_in")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[messageSmsNotifications] get opt-in:", error)
    return false
  }

  return data?.message_sms_opt_in === true
}

export async function upsertMessageSmsOptInForUser(
  supabase: SupabaseClient,
  userId: string,
  messageSmsOptIn: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      message_sms_opt_in: messageSmsOptIn,
    },
    { onConflict: "user_id" },
  )

  if (error) {
    console.error("[messageSmsNotifications] upsert opt-in:", error)
    return { ok: false, error: "Failed to save preference." }
  }

  return { ok: true }
}

export type MessageSmsReceiverNotificationContext = {
  smsOptIn: boolean
  phoneE164: string | null
  email: string | null
}

/**
 * Loads receiver SMS notification context for Klaviyo "Message Sent" events.
 */
export async function resolveMessageSmsPhoneE164(
  supabase: SupabaseClient,
  userId: string,
  authPhone?: string | null,
): Promise<string | null> {
  const profilePhone = await resolveProfilePhoneE164(supabase, userId, authPhone)
  return profilePhone ?? resolveAddressPhoneE164(supabase, userId)
}

export async function getMessageSmsReceiverContext(
  supabase: SupabaseClient,
  receiverUserId: string,
  authEmail?: string | null,
  authPhone?: string | null,
): Promise<MessageSmsReceiverNotificationContext> {
  const [smsOptIn, phoneE164] = await Promise.all([
    getMessageSmsOptInForUser(supabase, receiverUserId),
    resolveMessageSmsPhoneE164(supabase, receiverUserId, authPhone),
  ])

  return {
    smsOptIn,
    phoneE164,
    email: authEmail?.trim() || null,
  }
}
