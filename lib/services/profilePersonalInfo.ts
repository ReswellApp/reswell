import { createClient } from "@/lib/supabase/server"
import {
  getProfilePersonalInfo,
  resolveProfilePhoneE164,
  updateProfilePersonalInfo,
} from "@/lib/db/profilePersonalInfo"
import { subscribeKlaviyoProfileSmsConsent } from "@/lib/klaviyo/subscribe-profile-sms-consent"
import {
  profilePersonalInfoInputSchema,
  profilePersonalPhoneInputSchema,
} from "@/lib/validations/profilePersonalInfo"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

export type ProfilePersonalInfoState = {
  first_name: string | null
  last_name: string | null
  phone: string | null
  has_phone: boolean
}

export async function loadProfilePersonalInfoStateForUser(
  userId: string,
  authPhone?: string | null,
): Promise<ProfilePersonalInfoState> {
  const supabase = await createClient()
  const personal = await getProfilePersonalInfo(supabase, userId)
  const phoneE164 = await resolveProfilePhoneE164(supabase, userId, authPhone)

  return {
    first_name: personal?.first_name ?? null,
    last_name: personal?.last_name ?? null,
    phone: personal?.phone ?? null,
    has_phone: phoneE164 != null,
  }
}

export type SaveProfilePersonalInfoResult =
  | { ok: true; personal: ProfilePersonalInfoState }
  | { ok: false; error: string; code?: "invalid_phone" }

export async function saveProfilePersonalInfo(
  input: unknown,
): Promise<SaveProfilePersonalInfoResult> {
  const parsed = profilePersonalInfoInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const priorPersonal = await getProfilePersonalInfo(supabase, user.id)
  const updatePayload = { ...parsed.data }

  if (parsed.data.phone !== undefined) {
    const raw = parsed.data.phone?.trim() || null
    updatePayload.phone = raw
    updatePayload.transactional_sms_opt_in = Boolean(raw && toE164UsPhone(raw))
  }

  const saved = await updateProfilePersonalInfo(supabase, user.id, updatePayload)
  if (!saved.ok) {
    return { ok: false, error: saved.error, code: saved.code }
  }

  if (parsed.data.phone !== undefined) {
    const phoneE164 = toE164UsPhone(parsed.data.phone?.trim() || "")
    if (phoneE164) {
      void subscribeKlaviyoProfileSmsConsent({
        phoneNumber: phoneE164,
        email: user.email,
        externalId: user.id,
        transactional: "SUBSCRIBED",
      })
    } else if (priorPersonal?.phone) {
      const priorE164 = toE164UsPhone(priorPersonal.phone)
      if (priorE164) {
        void subscribeKlaviyoProfileSmsConsent({
          phoneNumber: priorE164,
          email: user.email,
          externalId: user.id,
          transactional: "UNSUBSCRIBED",
        })
      }
    }
  }

  const personal = await loadProfilePersonalInfoStateForUser(user.id, user.phone)
  return { ok: true, personal }
}

export type SaveProfilePersonalPhoneResult =
  | { ok: true; phone: string | null; has_phone: boolean }
  | { ok: false; error: string; code?: "invalid_phone" }

export async function saveProfilePersonalPhone(
  input: unknown,
): Promise<SaveProfilePersonalPhoneResult> {
  const parsed = profilePersonalPhoneInputSchema.safeParse(input)
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

  const phoneE164 = toE164UsPhone(parsed.data.phone)
  const saved = await updateProfilePersonalInfo(supabase, user.id, {
    phone: phoneE164 ?? parsed.data.phone,
    transactional_sms_opt_in: phoneE164 != null,
  })

  if (!saved.ok) {
    return { ok: false, error: saved.error, code: saved.code }
  }

  return {
    ok: true,
    phone: phoneE164 ?? parsed.data.phone.trim(),
    has_phone: phoneE164 != null,
  }
}

export async function saveProfilePersonalPhoneAndSubscribeSms(
  input: unknown,
): Promise<
  | { ok: true; has_phone: true }
  | { ok: false; error: string; code?: "invalid_phone" }
> {
  const saved = await saveProfilePersonalPhone(input)
  if (!saved.ok) {
    return saved
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const phoneE164 = toE164UsPhone(saved.phone)
  if (!phoneE164) {
    return { ok: false, error: "Enter a valid US phone number.", code: "invalid_phone" }
  }

  const subscribed = await subscribeKlaviyoProfileSmsConsent({
    phoneNumber: phoneE164,
    email: user.email,
    externalId: user.id,
    transactional: "SUBSCRIBED",
    marketing: "SUBSCRIBED",
  })
  if (!subscribed.ok && !subscribed.skipped) {
    console.error("[profilePersonalInfo] Klaviyo SMS subscribe failed:", subscribed.status, subscribed.detail)
    return {
      ok: false,
      error: "Could not register your number for text alerts. Try again in a moment.",
    }
  }

  return { ok: true, has_phone: true }
}
