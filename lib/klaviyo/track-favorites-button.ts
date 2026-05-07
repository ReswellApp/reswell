/**
 * Server-only: Klaviyo Events API — fires when a buyer saves a listing to favorites (heart).
 *
 * **Metric name in Klaviyo:** `Favorites button` — use as the flow trigger to email the
 * **listing owner** when someone favorites their listing.
 *
 * **Profile = seller** (`external_id` = Supabase user id of `listings.user_id`). Who tapped
 * the heart is under `favorited_by` (nested object), same pattern as `Message Sent` /
 * `message_from` to avoid Klaviyo mis-attaching scalar emails to the wrong profile.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

async function getListingOwnerEmail(ownerUserId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null
  }
  try {
    const admin = createServiceRoleClient()
    const r = await admin.auth.admin.getUserById(ownerUserId)
    return r.data.user?.email?.trim() || null
  } catch {
    return null
  }
}

/** Public-facing label: shop name for shops, else display_name (matches listing UI). */
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

export type KlaviyoFavoritesButtonPayload = {
  listingOwnerId: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string | null
  favoriterUserId: string
  favoriterEmail: string | null
  favoriterProfile: {
    display_name?: string | null
    shop_name?: string | null
    is_shop?: boolean | null
  } | null
  favoriteId: string
  favoritedAt: string
}

export async function trackKlaviyoFavoritesButton(
  payload: KlaviyoFavoritesButtonPayload,
): Promise<void> {
  const ownerEmail = await getListingOwnerEmail(payload.listingOwnerId)
  const favoriterDisplayName = displayNameFromProfileRow(payload.favoriterProfile)

  await sendKlaviyoServerEvent({
    metricName: "Favorites button",
    profile: {
      external_id: payload.listingOwnerId,
      email: ownerEmail,
    },
    properties: {
      time: payload.favoritedAt,
      listing_id: payload.listingId,
      listing_title: payload.listingTitle,
      listing_slug: payload.listingSlug ?? "",
      listing_section: payload.listingSection ?? "",
      favorite_id: payload.favoriteId,
      listing_owner_user_id: payload.listingOwnerId,
      favorited_by: {
        user_id: payload.favoriterUserId,
        display_name: favoriterDisplayName,
        email: payload.favoriterEmail ?? "",
      },
    },
    uniqueId: `favorites-button-${payload.favoriteId}`,
  })
}
