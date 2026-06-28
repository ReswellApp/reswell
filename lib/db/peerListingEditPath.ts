import { createClient } from "@/lib/supabase/server"
import { peerListingEditHref } from "@/lib/peer-listing-sections"

/** Resolve the sell-flow edit URL for a listing owned by the signed-in user. */
export async function fetchOwnedPeerListingEditPath(
  listingId: string,
  userId: string,
): Promise<string | null> {
  const trimmed = listingId.trim()
  if (!trimmed) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("id, section")
    .eq("id", trimmed)
    .eq("user_id", userId)
    .maybeSingle()

  if (!data?.id) return null
  return peerListingEditHref(data.section, data.id)
}

/** Resolve the sell-flow edit URL from listing id alone (section lookup only). */
export async function fetchPeerListingEditPath(listingId: string): Promise<string | null> {
  const trimmed = listingId.trim()
  if (!trimmed) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("id, section")
    .eq("id", trimmed)
    .maybeSingle()

  if (!data?.id) return null
  return peerListingEditHref(data.section, data.id)
}
