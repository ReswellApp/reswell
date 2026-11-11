import {
  mobileProfileAddressBodySchema,
  mobileProfileAddressPatchSchema,
  mobileProfileAddressesSchema,
  mobileProfileAddressSchema,
  type MobileProfileAddress,
  type MobileProfileAddresses,
} from "@reswell/api-contract"
import { fetchProfileAddresses, profileAddressOneLine } from "@/lib/db/profile-addresses"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import {
  createProfileAddressForUser,
  deleteProfileAddressForUser,
  updateProfileAddressForUser,
  type ProfileAddressFailureCode,
} from "@/lib/services/profileAddresses"
import type { SupabaseClient } from "@supabase/supabase-js"

export function toMobileProfileAddress(address: ProfileAddressRow): MobileProfileAddress | null {
  if (!address.line1?.trim() || !address.city?.trim() || !address.postal_code?.trim()) return null
  const parsed = mobileProfileAddressSchema.safeParse({
    id: address.id,
    label: address.label,
    full_name: address.full_name,
    line: profileAddressOneLine(address),
    is_default: address.is_default,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
  })
  return parsed.success ? parsed.data : null
}

function clientValidationMessage(error: string): string {
  if (error.includes("Personal information")) {
    return "Add your first and last name before saving an address."
  }
  if (error.includes("checkout contact details")) {
    return "Add a phone number before saving an address."
  }
  return error
}

function writeFailure(
  code: ProfileAddressFailureCode,
  error: string,
  fallback: string,
): MobileApiResult<MobileProfileAddresses> {
  if (code === "validation") return { ok: false, status: 400, error: clientValidationMessage(error) }
  if (code === "not_found") return { ok: false, status: 404, error }
  return { ok: false, status: 500, error: fallback }
}

export async function listMobileProfileAddressesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileProfileAddresses>> {
  const listed = await fetchProfileAddresses(supabase, userId)
  if (listed.error) return { ok: false, status: 500, error: "Unable to load addresses right now" }
  const addresses = listed.addresses.flatMap((address) => {
    const mapped = toMobileProfileAddress(address)
    return mapped ? [mapped] : []
  })
  const parsed = mobileProfileAddressesSchema.safeParse({ addresses })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load addresses right now" }
  return { ok: true, data: parsed.data }
}

export async function createMobileProfileAddressService(
  supabase: SupabaseClient,
  userId: string,
  body: unknown,
): Promise<MobileApiResult<MobileProfileAddresses>> {
  const parsed = mobileProfileAddressBodySchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Enter a complete shipping address" }
  }
  const saved = await createProfileAddressForUser(supabase, userId, parsed.data)
  if (!saved.ok) return writeFailure(saved.code, saved.error, "Unable to save that address")
  return listMobileProfileAddressesService(supabase, userId)
}

export async function updateMobileProfileAddressService(
  supabase: SupabaseClient,
  userId: string,
  addressId: string,
  body: unknown,
): Promise<MobileApiResult<MobileProfileAddresses>> {
  const parsed = mobileProfileAddressPatchSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Enter a complete shipping address" }
  }
  const saved = await updateProfileAddressForUser(supabase, userId, addressId, parsed.data)
  if (!saved.ok) return writeFailure(saved.code, saved.error, "Unable to save that address")
  return listMobileProfileAddressesService(supabase, userId)
}

export async function deleteMobileProfileAddressService(
  supabase: SupabaseClient,
  userId: string,
  addressId: string,
): Promise<MobileApiResult<MobileProfileAddresses>> {
  const deleted = await deleteProfileAddressForUser(supabase, userId, addressId)
  if (!deleted.ok) return writeFailure(deleted.code, deleted.error, "Unable to delete that address")
  return listMobileProfileAddressesService(supabase, userId)
}
