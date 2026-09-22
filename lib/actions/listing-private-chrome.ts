"use server"

import { listingCanBePermanentlyDeleted } from "@/lib/db/listingDeleteEligibility"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import {
  sellerCanRelistListing,
  type ListingPrivateChrome,
} from "@/lib/listing-private-chrome"
import { listListingCartHoldersForAdmin } from "@/lib/services/listingCartHolders"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

/**
 * Signed-in listing chrome. Called from the client after paint so the public
 * listing document does not read cookies.
 */
export async function loadListingPrivateChrome(
  listingId: string,
): Promise<ListingPrivateChrome | null> {
  const id = listingId.trim()
  if (!id) return null

  const { supabase, user } = await getCachedRequestSession()
  if (!user) return null

  const [{ data: profile }, { data: listing }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, user_id, section, status, hidden_from_site, sold_off_platform, archived_at")
      .eq("id", id)
      .maybeSingle(),
  ])

  const isAdmin = profile?.is_admin === true
  const isOwner = listing?.user_id === user.id
  if (!isAdmin && !isOwner) return null

  const status = typeof listing?.status === "string" ? listing.status : ""
  const section = typeof listing?.section === "string" ? listing.section : ""
  const hidden = listing?.hidden_from_site === true
  const canOfferToCart =
    isOwner &&
    isPeerListingSection(section) &&
    status !== "draft" &&
    status !== "delinquent" &&
    status !== "sold" &&
    !hidden

  const [adminHolders, canDelete, cartHolderCount, canRelist] = await Promise.all([
    isAdmin ? listListingCartHoldersForAdmin(id) : Promise.resolve([]),
    isOwner && status !== "draft"
      ? listingCanBePermanentlyDeleted(supabase, id)
      : Promise.resolve(false),
    canOfferToCart ? getListingCartHolderCount(supabase, id) : Promise.resolve(0),
    isOwner && listing?.user_id
      ? sellerCanRelistListing(supabase, user.id, {
          id: listing.id,
          user_id: listing.user_id,
          status: listing.status,
          sold_off_platform: listing.sold_off_platform,
          archived_at: listing.archived_at,
        })
      : Promise.resolve(false),
  ])

  return {
    isAdmin,
    adminHolders,
    owner: isOwner
      ? { userId: user.id, canDelete, cartHolderCount, canRelist }
      : null,
  }
}
