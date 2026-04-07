/**
 * Server-only: Klaviyo Events API — fires when someone saves/favorites a listing.
 *
 * The Klaviyo **profile** on the event is the **listing seller** so flows email them by default.
 * Favoriter details live under `favorited_by` (nested) for templates — same pattern as `message_from`
 * in track-message-sent.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

async function getUserAuthEmail(userId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null
  }
  try {
    const admin = createServiceRoleClient()
    const r = await admin.auth.admin.getUserById(userId)
    return r.data.user?.email?.trim() || null
  } catch {
    return null
  }
}

function displayNameFromProfileRow(
  data: {
    display_name?: string | null
    shop_name?: string | null
    is_shop?: boolean | null
  } | null,
): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Someone"
}

export type KlaviyoListingFavoritedPayload = {
  sellerUserId: string
  favoriterUserId: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  favoriteId: string
  favoritedAt: string
  /**
   * From `profiles.email` for the seller — used when Admin `getUserById` is unavailable
   * (e.g. no service role in dev) so Klaviyo still gets a stable recipient email.
   */
  sellerEmailFromProfile?: string | null
  sessionFavoriter: {
    email: string | null
    profile: {
      display_name?: string | null
      shop_name?: string | null
      is_shop?: boolean | null
    } | null
  }
}

/**
 * Metric **"Listing Favorited"** — use in a flow to email the seller when their item is saved.
 */
export async function trackKlaviyoListingFavorited(
  payload: KlaviyoListingFavoritedPayload,
): Promise<void> {
  const {
    sellerUserId,
    favoriterUserId,
    listingId,
    listingTitle,
    listingSlug,
    favoriteId,
    favoritedAt,
    sellerEmailFromProfile,
    sessionFavoriter,
  } = payload

  if (sellerUserId === favoriterUserId) return

  const authEmail = await getUserAuthEmail(sellerUserId)
  const profileEmail =
    typeof sellerEmailFromProfile === "string" && sellerEmailFromProfile.trim()
      ? sellerEmailFromProfile.trim()
      : null
  const sellerEmail = authEmail ?? profileEmail
  const favoriterDisplayName = displayNameFromProfileRow(sessionFavoriter.profile)

  const listingPath = `/l/${(listingSlug?.trim() || listingId).trim()}`

  const result = await sendKlaviyoServerEvent({
    metricName: "Listing Favorited",
    profile: {
      external_id: sellerUserId,
      email: sellerEmail,
    },
    properties: {
      time: favoritedAt,
      listing_id: listingId,
      listing_title: listingTitle,
      listing_url_path: listingPath,
      seller_user_id: sellerUserId,
      favorited_by: {
        user_id: favoriterUserId,
        display_name: favoriterDisplayName,
      },
    },
    uniqueId: `listing-favorited-${favoriteId}`,
  })

  if (result.skipped && result.skipReason) {
    console.warn("[klaviyo] Listing Favorited skipped:", result.skipReason)
  }
}
