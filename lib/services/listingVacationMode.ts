import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { updateListingHiddenFromSite } from "@/lib/db/listings"
import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"
import { trackKlaviyoListingAutoVacation } from "@/lib/klaviyo/track-listing-auto-vacation"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import type { ListingVisibilitySource } from "@/lib/listing-visibility-sources"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"

const VACATION_ALLOWED_STATUSES = new Set(["active", "pending_sale"])

type VacationModeListingRow = {
  id: string
  user_id: string
  status: string | null
  hidden_from_site: boolean | null
  title: string | null
  slug: string | null
  section: string | null
  price: string | number | null
  listing_images: KlaviyoListingImage[] | null
}

export async function setListingVacationModeForSeller(params: {
  supabase: SupabaseClient
  userId: string
  listingId: string
  vacationMode: boolean
  /** Defaults to seller_vacation; inactivity job passes seller_inactivity. */
  source?: Extract<ListingVisibilitySource, "seller_vacation" | "seller_inactivity">
}): Promise<{ ok: true; changed: boolean } | { ok: false; error: string; status: number }> {
  const listingId = params.listingId.trim()
  if (!listingId) {
    return { ok: false, error: "Missing listing id", status: 400 }
  }

  const { data: listing, error: listingErr } = await params.supabase
    .from("listings")
    .select("id, user_id, status, hidden_from_site, title, slug, section, price, listing_images")
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr) {
    console.error("[listingVacationMode] load listing:", listingErr.message)
    return { ok: false, error: "Could not load listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }
  if (listing.user_id !== params.userId) {
    return { ok: false, error: "You can only update your own listings", status: 403 }
  }

  const status = String(listing.status ?? "")
  if (!VACATION_ALLOWED_STATUSES.has(status)) {
    return {
      ok: false,
      error: "Vacation mode is only available for live listings",
      status: 409,
    }
  }

  const hiddenFromSite = params.vacationMode
  if (Boolean(listing.hidden_from_site) === hiddenFromSite) {
    return { ok: true, changed: false }
  }

  // Going live again is a sell action — blocked for seller-banned accounts.
  if (!hiddenFromSite) {
    const sellGuard = await evaluateSellerCanSell(params.supabase, params.userId)
    if (!sellGuard.ok) {
      return { ok: false, error: sellGuard.userMessage, status: 403 }
    }
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const source = params.source ?? "seller_vacation"
  const updated = await updateListingHiddenFromSite(service, listingId, hiddenFromSite, {
    source,
  })
  if (!updated.ok) {
    return { ok: false, error: updated.message, status: 500 }
  }

  await recordListingVisibilityEvent(service, {
    listingId,
    hiddenFromSite,
    source,
    actorUserId: params.userId,
    metadata: { vacationMode: params.vacationMode },
  })

  if (hiddenFromSite) {
    try {
      await deleteAllCartRowsForListing(service, listingId)
    } catch {
      // best-effort
    }
  }

  await syncListingToIndex(params.supabase, listingId)
  void syncListingToGoogleMerchantBestEffort(params.supabase, listingId)
  await revalidateAfterListingSiteModeration(params.supabase, [listingId])

  if (hiddenFromSite && source === "seller_inactivity") {
    const row = listing as VacationModeListingRow
    const images = Array.isArray(row.listing_images) ? row.listing_images : null
    try {
      const klaviyoResult = await trackKlaviyoListingAutoVacation({
        sellerUserId: params.userId,
        listingId,
        listingTitle: typeof row.title === "string" ? row.title : "",
        listingSlug: row.slug,
        listingSection: typeof row.section === "string" && row.section.trim() ? row.section : "surfboards",
        price: row.price,
        listingImages: images,
      })
      if (!klaviyoResult.ok && !klaviyoResult.skipped) {
        console.error(
          "[listingVacationMode] klaviyo Listing Auto Vacation:",
          klaviyoResult.status,
          klaviyoResult.detail.slice(0, 200),
        )
      }
    } catch (e) {
      console.error(
        "[listingVacationMode] klaviyo Listing Auto Vacation:",
        e instanceof Error ? e.message : e,
      )
    }
  }

  return { ok: true, changed: true }
}
