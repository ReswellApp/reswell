import type { SupabaseClient } from "@supabase/supabase-js"

export const LISTING_IMPORT_ACCESS_COOKIE = "listing_import_access"

export function listingImportAccessKeyConfigured(): boolean {
  return Boolean(process.env.LISTING_IMPORT_ACCESS_KEY?.trim())
}

export function isListingImportAccessKeyValid(key: string | null | undefined): boolean {
  const expected = process.env.LISTING_IMPORT_ACCESS_KEY?.trim()
  if (!expected || !key?.trim()) return false
  return key.trim() === expected
}

export async function profileHasListingImportAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
  return data?.is_admin === true
}

export function cookieGrantsListingImportAccess(
  cookieValue: string | null | undefined,
): boolean {
  if (cookieValue !== "1") return false
  return listingImportAccessKeyConfigured()
}

export async function userHasListingImportAccess(opts: {
  supabase: SupabaseClient
  userId: string | null
  queryKey?: string | null
  cookieValue?: string | null
}): Promise<boolean> {
  if (isListingImportAccessKeyValid(opts.queryKey)) return true
  if (cookieGrantsListingImportAccess(opts.cookieValue)) return true
  if (opts.userId) {
    return profileHasListingImportAccess(opts.supabase, opts.userId)
  }
  return false
}
