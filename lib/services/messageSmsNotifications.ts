import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getMessageSmsOptInForUser,
  upsertMessageSmsOptInForUser,
} from "@/lib/db/messageSmsNotifications"
import { saveProfilePersonalPhoneAndSubscribeSms } from "@/lib/services/profilePersonalInfo"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { subscribeKlaviyoProfileSmsMarketing } from "@/lib/klaviyo/subscribe-profile-sms-marketing"
import { messageSmsPhoneInputSchema } from "@/lib/validations/messageSmsPhone"

export type MessageSmsNotificationsState = {
  message_sms_opt_in: boolean
  has_phone: boolean
}

export async function loadMessageSmsNotificationsStateForUser(
  userId: string,
  authPhone?: string | null,
): Promise<MessageSmsNotificationsState> {
  const service = createServiceRoleClient()
  const [message_sms_opt_in, phoneE164] = await Promise.all([
    getMessageSmsOptInForUser(service, userId),
    resolveProfilePhoneE164(service, userId, authPhone),
  ])

  return {
    message_sms_opt_in,
    has_phone: phoneE164 != null,
  }
}

const updateSchema = z.object({
  enabled: z.boolean(),
})

export type UpdateMessageSmsNotificationsResult =
  | { ok: true; message_sms_opt_in: boolean }
  | { ok: false; error: string; code?: "missing_phone" | "invalid_phone" }

export type EnableMessageSmsWithPhoneResult =
  | { ok: true; message_sms_opt_in: true }
  | { ok: false; error: string; code?: "invalid_phone" }

export async function enableMessageSmsNotificationsWithPhone(
  input: unknown,
): Promise<EnableMessageSmsWithPhoneResult> {
  const parsed = messageSmsPhoneInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid phone number.",
      code: "invalid_phone",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const savedPhone = await saveProfilePersonalPhoneAndSubscribeSms(parsed.data)
  if (!savedPhone.ok) {
    return {
      ok: false,
      error: savedPhone.error,
      code: savedPhone.code,
    }
  }

  const optInSaved = await upsertMessageSmsOptInForUser(supabase, user.id, true)
  if (!optInSaved.ok) {
    return { ok: false, error: optInSaved.error }
  }

  return { ok: true, message_sms_opt_in: true }
}

export async function updateMessageSmsNotificationsOptIn(
  input: unknown,
): Promise<UpdateMessageSmsNotificationsResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const { enabled } = parsed.data

  if (enabled) {
    const phoneE164 = await resolveProfilePhoneE164(supabase, user.id, user.phone)
    if (!phoneE164) {
      return {
        ok: false,
        error: "Add a phone number to your personal information under Addresses before enabling text alerts.",
        code: "missing_phone",
      }
    }

    const saved = await upsertMessageSmsOptInForUser(supabase, user.id, true)
    if (!saved.ok) {
      return { ok: false, error: saved.error }
    }

    void subscribeKlaviyoProfileSmsMarketing({
      phoneNumber: phoneE164,
      email: user.email,
      consent: "SUBSCRIBED",
    })

    return { ok: true, message_sms_opt_in: true }
  }

  const saved = await upsertMessageSmsOptInForUser(supabase, user.id, false)
  if (!saved.ok) {
    return { ok: false, error: saved.error }
  }

  const phoneE164 = await resolveProfilePhoneE164(supabase, user.id, user.phone)
  if (phoneE164) {
    void subscribeKlaviyoProfileSmsMarketing({
      phoneNumber: phoneE164,
      email: user.email,
      consent: "UNSUBSCRIBED",
    })
  }

  return { ok: true, message_sms_opt_in: false }
}
