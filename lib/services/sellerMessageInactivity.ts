import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchListingsEligibleForSellerMessageInactivity,
  recordSellerMessageInactivityAction,
  SELLER_MESSAGE_INACTIVITY_DAYS,
  type SellerMessageInactivityEligibleRow,
} from "@/lib/db/sellerMessageInactivity"
import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"
import {
  trackKlaviyoInactiveSeller,
  type KlaviyoInactiveSellerMissedMessage,
} from "@/lib/klaviyo/track-inactive-seller"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { setListingVacationModeForSeller } from "@/lib/services/listingVacationMode"

export type ProcessSellerMessageInactivitySummary = {
  eligible: number
  listingsProcessed: number
  vacationApplied: number
  klaviyoEmitted: number
  failed: number
  errors: string[]
}

type ListingInactivityGroup = {
  listingId: string
  sellerId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  rows: SellerMessageInactivityEligibleRow[]
}

function groupEligibleRowsByListing(
  rows: SellerMessageInactivityEligibleRow[],
): ListingInactivityGroup[] {
  const byListing = new Map<string, ListingInactivityGroup>()

  for (const row of rows) {
    const existing = byListing.get(row.listing_id)
    if (existing) {
      existing.rows.push(row)
      continue
    }
    byListing.set(row.listing_id, {
      listingId: row.listing_id,
      sellerId: row.seller_id,
      listingTitle: row.listing_title,
      listingSlug: row.listing_slug,
      listingSection: row.listing_section,
      rows: [row],
    })
  }

  return [...byListing.values()]
}

function buildMissedMessages(
  rows: SellerMessageInactivityEligibleRow[],
): KlaviyoInactiveSellerMissedMessage[] {
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  return rows.map((row) => ({
    conversation_id: row.conversation_id,
    message_id: row.buyer_message_id,
    buyer_user_id: row.buyer_id,
    buyer_message_at: row.buyer_message_at,
    message: row.buyer_message_content,
    messages_url: `${origin}/messages/${row.conversation_id}`,
  }))
}

async function fetchListingImagesForKlaviyo(
  supabase: SupabaseClient,
  listingId: string,
): Promise<KlaviyoListingImage[] | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("listing_images")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  const images = (data as { listing_images?: KlaviyoListingImage[] | null }).listing_images
  return Array.isArray(images) ? images : null
}

async function fetchSellerDisplayName(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", sellerId)
    .maybeSingle()

  if (!data) return null
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || null
}

/**
 * For listing threads where the buyer's latest message is 7+ days old with no seller reply:
 * apply vacation mode on the listing (which emits **Listing Auto Vacation**)
 * and emit Klaviyo **Inactive Seller** to the seller.
 */
export async function processSellerMessageInactivity(
  supabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<ProcessSellerMessageInactivitySummary> {
  const cutoff = new Date(
    referenceTime.getTime() - SELLER_MESSAGE_INACTIVITY_DAYS * 24 * 60 * 60 * 1000,
  )

  const { data: eligibleRows, error: fetchErr } =
    await fetchListingsEligibleForSellerMessageInactivity(supabase, cutoff)

  if (fetchErr) {
    return {
      eligible: 0,
      listingsProcessed: 0,
      vacationApplied: 0,
      klaviyoEmitted: 0,
      failed: 0,
      errors: [fetchErr],
    }
  }

  const groups = groupEligibleRowsByListing(eligibleRows)
  const errors: string[] = []
  let vacationApplied = 0
  let klaviyoEmitted = 0
  let failed = 0

  for (const group of groups) {
    const vacationResult = await setListingVacationModeForSeller({
      supabase,
      userId: group.sellerId,
      listingId: group.listingId,
      vacationMode: true,
      source: "seller_inactivity",
    })

    const vacationOk = vacationResult.ok
    const vacationAppliedAt = vacationOk ? new Date().toISOString() : null

    if (!vacationOk) {
      failed += 1
      errors.push(
        `${group.listingId}: vacation mode failed — ${vacationResult.error}`,
      )
      continue
    }

    vacationApplied += 1

    const [listingImages, sellerDisplayName] = await Promise.all([
      fetchListingImagesForKlaviyo(supabase, group.listingId),
      fetchSellerDisplayName(supabase, group.sellerId),
    ])

    const klaviyoResult = await trackKlaviyoInactiveSeller({
      sellerUserId: group.sellerId,
      sellerDisplayName,
      listingId: group.listingId,
      listingTitle: group.listingTitle,
      listingSlug: group.listingSlug,
      listingSection: group.listingSection,
      listingImages,
      vacationModeApplied: true,
      missedMessages: buildMissedMessages(group.rows),
    })

    const klaviyoOk = klaviyoResult.ok
    const klaviyoSkipped = klaviyoResult.skipped
    const klaviyoSentAt = klaviyoOk ? new Date().toISOString() : null

    if (!klaviyoOk && !klaviyoSkipped) {
      failed += 1
      errors.push(
        `${group.listingId}: Klaviyo ${klaviyoResult.status} — ${klaviyoResult.detail.slice(0, 200)}`,
      )
      continue
    }

    if (klaviyoOk) {
      klaviyoEmitted += 1
    }

    const recordOutcomes = await Promise.all(
      group.rows.map((row) =>
        recordSellerMessageInactivityAction(supabase, {
          listingId: row.listing_id,
          conversationId: row.conversation_id,
          sellerId: row.seller_id,
          buyerMessageId: row.buyer_message_id,
          buyerMessageAt: row.buyer_message_at,
          vacationAppliedAt,
          klaviyoSentAt,
        }),
      ),
    )

    for (const [i, rec] of recordOutcomes.entries()) {
      if (rec.error) {
        failed += 1
        errors.push(
          `${group.rows[i]?.conversation_id}: record action failed — ${rec.error}`,
        )
      }
    }
  }

  return {
    eligible: eligibleRows.length,
    listingsProcessed: groups.length,
    vacationApplied,
    klaviyoEmitted,
    failed,
    errors: errors.slice(0, 50),
  }
}
