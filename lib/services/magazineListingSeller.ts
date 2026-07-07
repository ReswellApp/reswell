import type { SupabaseClient } from "@supabase/supabase-js"
import { MAGAZINE_LISTING_SELLER_EMAIL } from "@/lib/magazine-listing-config"

export async function resolveMagazineListingSellerId(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", MAGAZINE_LISTING_SELLER_EMAIL)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data?.id) {
    throw new Error(
      `Magazine seller profile not found for ${MAGAZINE_LISTING_SELLER_EMAIL}. Create the account first.`,
    )
  }
  return data.id as string
}

export async function actorCanManageMagazineListings(
  supabase: SupabaseClient,
  actorUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", actorUserId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true
}
