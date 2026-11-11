"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  createProfileAddressForUser,
  deleteProfileAddressForUser,
  updateProfileAddressForUser,
} from "@/lib/services/profileAddresses"

async function loadAddressAccount(
  access: "read" | "write",
): Promise<{ supabase: SupabaseClient; profileId: string } | { error: string }> {
  const managed = await resolveManagedSeller("profile.manage")
  if (!managed.ok) return { error: managed.error }
  if (access === "write" && managed.seller.actingAsShop) {
    try {
      return { supabase: createServiceRoleClient(), profileId: managed.seller.sellerId }
    } catch {
      return { error: "Could not update this shop right now." }
    }
  }
  const supabase = await createClient()
  return { supabase, profileId: managed.seller.sellerId }
}

export async function getProfileAddresses(): Promise<{
  addresses: ProfileAddressRow[]
  error: string | null
}> {
  const account = await loadAddressAccount("read")
  if ("error" in account) {
    return { addresses: [], error: account.error }
  }
  const { supabase, profileId } = account

  const { addresses, error } = await fetchProfileAddresses(supabase, profileId)

  return { addresses, error: error ?? null }
}

export async function createProfileAddress(
  raw: unknown,
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
  const account = await loadAddressAccount("write")
  if ("error" in account) {
    return { address: null, error: account.error }
  }
  const result = await createProfileAddressForUser(account.supabase, account.profileId, raw)
  if (!result.ok) return { address: null, error: result.error }
  return { address: result.address, error: null }
}

export async function updateProfileAddress(
  addressId: string,
  raw: unknown,
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
  const account = await loadAddressAccount("write")
  if ("error" in account) {
    return { address: null, error: account.error }
  }
  const result = await updateProfileAddressForUser(account.supabase, account.profileId, addressId, raw)
  if (!result.ok) return { address: null, error: result.error }
  return { address: result.address, error: null }
}

export async function deleteProfileAddress(addressId: string): Promise<{ ok: boolean; error: string | null }> {
  const account = await loadAddressAccount("write")
  if ("error" in account) {
    return { ok: false, error: account.error }
  }
  const result = await deleteProfileAddressForUser(account.supabase, account.profileId, addressId)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, error: null }
}
