import type { SupabaseClient } from "@supabase/supabase-js"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

export type ProfilePersonalInfoRow = {
  first_name: string | null
  last_name: string | null
  phone: string | null
  transactional_sms_opt_in: boolean
}

const SELECT = "first_name, last_name, phone, transactional_sms_opt_in"

export async function getProfilePersonalInfo(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfilePersonalInfoRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[profilePersonalInfo] get:", error)
    return null
  }

  return (data as ProfilePersonalInfoRow | null) ?? null
}

export async function updateProfilePersonalInfo(
  supabase: SupabaseClient,
  userId: string,
  input: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    transactional_sms_opt_in?: boolean
  },
): Promise<{ ok: true } | { ok: false; error: string; code?: "invalid_phone" }> {
  const update: Record<string, string | null | boolean> = {}

  if (input.first_name !== undefined) {
    update.first_name = input.first_name?.trim() || null
  }
  if (input.last_name !== undefined) {
    update.last_name = input.last_name?.trim() || null
  }
  if (input.phone !== undefined) {
    const raw = input.phone?.trim() || null
    if (raw && !toE164UsPhone(raw)) {
      return { ok: false, error: "Enter a valid US phone number.", code: "invalid_phone" }
    }
    update.phone = raw
  }
  if (input.transactional_sms_opt_in !== undefined) {
    update.transactional_sms_opt_in = input.transactional_sms_opt_in
  }

  if (Object.keys(update).length === 0) {
    return { ok: true }
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", userId)

  if (error) {
    console.error("[profilePersonalInfo] update:", error)
    return { ok: false, error: "Could not save personal information." }
  }

  return { ok: true }
}

export async function resolveProfilePhoneE164(
  supabase: SupabaseClient,
  userId: string,
  authPhone?: string | null,
): Promise<string | null> {
  const personal = await getProfilePersonalInfo(supabase, userId)
  return toE164UsPhone(personal?.phone) ?? toE164UsPhone(authPhone)
}
