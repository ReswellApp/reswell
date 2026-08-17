import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"
import { notifyFollowersNewListingKlaviyo } from "@/lib/services/notifyFollowersNewListingKlaviyo"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"

const PRICE_MIN = 0.01

type DraftListingRow = {
  id: string
  user_id: string
  status: string
  title: string | null
  description: string | null
  price: number | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  slug: string | null
  section: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  listing_images: { url: string | null }[] | null
}

export type PublishListingDraftResult =
  | { ok: true; listingId: string; slug: string }
  | { ok: false; message: string }

function normalizedDescription(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : ""
}

export function validateListingDraftPublishable(row: {
  status?: string | null
  price?: number | null
  description?: string | null
  city?: string | null
  state?: string | null
  latitude?: number | null
  longitude?: number | null
  imageCount: number
}): string | null {
  if (row.status !== "draft") {
    return "Only draft listings can be published."
  }
  const price = row.price
  if (price == null || !Number.isFinite(Number(price)) || Number(price) < PRICE_MIN) {
    return "Listing needs a price before it can go live."
  }
  const description = normalizedDescription(row.description)
  if (!description) {
    return "Listing needs a description before it can go live."
  }
  const hasLocation =
    Boolean(row.city?.trim() && row.state?.trim()) ||
    (row.latitude != null &&
      row.longitude != null &&
      Number.isFinite(Number(row.latitude)) &&
      Number.isFinite(Number(row.longitude)) &&
      Number(row.latitude) !== 0 &&
      Number(row.longitude) !== 0)
  if (!hasLocation) {
    return "Listing needs a pickup or ship-from location before it can go live."
  }
  if (row.imageCount < 1) {
    return "Listing needs at least one photo before it can go live."
  }
  return null
}

export async function applyPublishedListingSideEffects(
  supabase: SupabaseClient,
  listingId: string,
  sellerUserId: string,
): Promise<void> {
  try {
    await syncListingToIndex(supabase, listingId)
  } catch {
    // ES optional
  }

  try {
    await syncListingToGoogleMerchantBestEffort(supabase, listingId)
  } catch {
    // best-effort
  }

  try {
    await notifyBoardSavedSearchMatchesForListing(listingId)
  } catch {
    // best-effort
  }

  try {
    await notifyFollowersNewListingKlaviyo(listingId)
  } catch {
    // best-effort
  }

  await revalidateAfterListingSiteModeration(supabase, [listingId])
  revalidateBoardsBrowseCatalog()
  revalidateNavSearchSuggest()
  await revalidateSellersAfterListingChange(supabase, sellerUserId)
}

async function fetchDraftListingForPublish(
  supabase: SupabaseClient,
  listingId: string,
): Promise<DraftListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, status, title, description, price, city, state, latitude, longitude, slug, section, local_pickup, shipping_available, listing_images(url)",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data?.id) return null
  return data as DraftListingRow
}

export async function publishListingDraft(
  supabase: SupabaseClient,
  listingId: string,
  opts?: {
    sellerEmail?: string | null
    skipKlaviyo?: boolean
  },
): Promise<PublishListingDraftResult> {
  const row = await fetchDraftListingForPublish(supabase, listingId)
  if (!row) {
    return { ok: false, message: "Listing not found" }
  }

  const sellGuard = await evaluateSellerCanSell(supabase, row.user_id)
  if (!sellGuard.ok) {
    return { ok: false, message: sellGuard.userMessage }
  }

  const images = Array.isArray(row.listing_images) ? row.listing_images : []
  const validationError = validateListingDraftPublishable({
    status: row.status,
    price: row.price,
    description: row.description,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    imageCount: images.length,
  })
  if (validationError) {
    return { ok: false, message: validationError }
  }

  const title = row.title?.trim() || "listing"
  const slug = row.slug?.trim() || (await generateUniqueListingSlug(supabase, title))
  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update({
      status: "active",
      hidden_from_site: false,
      site_visibility_reason: null,
      slug,
      updated_at: now,
    })
    .eq("id", listingId)
    .eq("status", "draft")
    .select("id, slug, title, price, user_id, local_pickup, shipping_available, listing_images(url)")
    .single()

  if (updateError || !updated) {
    return { ok: false, message: updateError?.message ?? "Failed to publish listing" }
  }

  const publishedSlug = String((updated as { slug?: string }).slug ?? slug).trim()
  const sellerUserId = String((updated as { user_id: string }).user_id)

  await recordListingVisibilityEvent(supabase, {
    listingId,
    hiddenFromSite: false,
    source: "publish_draft",
    actorUserId: sellerUserId,
  })

  if (!opts?.skipKlaviyo) {
    let sellerEmail = opts?.sellerEmail ?? null
    if (!sellerEmail) {
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", sellerUserId)
        .maybeSingle()
      sellerEmail =
        typeof sellerProfile?.email === "string" ? sellerProfile.email : null
    }
    const primary =
      (updated as { listing_images?: { url: string | null }[] }).listing_images?.find(
        (img) => img.url?.trim(),
      ) ?? images.find((img) => img.url?.trim())
    void trackKlaviyoListingCreated({
      sellerUserId,
      sellerEmail,
      listingId,
      title: String((updated as { title?: string }).title ?? title),
      price: Number((updated as { price?: number }).price ?? row.price ?? 0),
      photoUrl: primary?.url?.trim() ?? null,
      localPickup: (updated as { local_pickup?: boolean | null }).local_pickup,
      shippingAvailable: (updated as { shipping_available?: boolean | null }).shipping_available,
    })
    void trackFirstTimeSellerForListingIfNeeded(supabase, {
      listingId,
      sellerUserId,
      sellerEmail,
    })
  }

  await applyPublishedListingSideEffects(supabase, listingId, sellerUserId)

  return { ok: true, listingId, slug: publishedSlug }
}
