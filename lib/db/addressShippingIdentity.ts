import type { SupabaseClient } from "@supabase/supabase-js"
import { getProfilePersonalInfo } from "@/lib/db/profilePersonalInfo"
import { formatProfileLegalName } from "@/lib/utils/profile-personal-info"

export type ResolvedAddressShippingIdentity = {
  full_name: string
  phone: string | null
}

/** Merges optional address overrides with private profile contact fields for shipping APIs. */
export async function resolveAddressShippingIdentity(
  supabase: SupabaseClient,
  userId: string,
  overrides?: {
    full_name?: string | null
    phone?: string | null
    display_name?: string | null
  },
): Promise<ResolvedAddressShippingIdentity> {
  const personal = await getProfilePersonalInfo(supabase, userId)

  const overrideName = overrides?.full_name?.trim()
  const overridePhone = overrides?.phone?.trim()

  return {
    full_name:
      overrideName ||
      formatProfileLegalName(
        personal?.first_name,
        personal?.last_name,
        overrides?.display_name,
      ),
    phone: overridePhone || personal?.phone?.trim() || null,
  }
}
