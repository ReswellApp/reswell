import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidateBoardsBrowseCatalog } from '@/lib/cache/revalidate-boards-browse-catalog'
import { revalidateSellersAfterListingChange } from '@/lib/cache/revalidate-sellers-directory-catalog'
import { revalidateNavSearchSuggest } from '@/lib/cache/revalidate-nav-search-suggest'
import { syncListingToIndex } from '@/lib/elasticsearch/listings-index'
import { syncListingToGoogleMerchantBestEffort } from '@/lib/services/googleMerchantSync'
import { slugify } from '@/lib/slugify'
import { trackKlaviyoListingCreated } from '@/lib/klaviyo/track-listing-created'
import { trackFirstTimeSellerForListingIfNeeded } from '@/lib/services/klaviyoFirstTimeSeller'
import { notifyBoardSavedSearchMatchesForListing } from '@/lib/services/notifyBoardSavedSearchMatches'
import { notifyFollowersNewListingKlaviyo } from '@/lib/services/notifyFollowersNewListingKlaviyo'
import { evaluateSellerCanSell } from '@/lib/services/sellerBan'
import { qualifyPublishedListingForGiveaways } from '@/lib/services/giveawayEntry'
import { LISTING_TITLE_MAX_LENGTH } from '@/lib/sell-form-validation'
import {
  composeListingDimensionsFromSplitListingFields,
  listingDimensionsColumnTrim,
} from '@/lib/listing-dimensions-storage'
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from '@/lib/listing-dimensions-display'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return NextResponse.json({ error: sellGuard.userMessage }, { status: 403 })
  }

  const body = await request.json()
  const {
    title,
    description,
    price,
    condition,
    section,
    category_id,
  } = body

  const {
    shipping_available,
    local_pickup,
    shipping_price,
    board_shipping_cost_mode,
    city,
    state,
    // Surfboard specific
    board_type,
    length_feet,
    length_inches,
    width,
    thickness,
    volume,
    brand,
    shaper,
    brand_id: bodyBrandId,
    brand_model_id: bodyBrandModelId,
    model: listingModelText,
    images = [],
    dimensions,
    length_inches_display,
    width_inches_display,
    thickness_inches_display,
    volume_display,
  } = body

  if (
    section === 'surfboards' &&
    (typeof city !== 'string' ||
      !city.trim() ||
      typeof state !== 'string' ||
      !state.trim())
  ) {
    return NextResponse.json(
      { error: 'City and state are required for surfboard listings' },
      { status: 400 },
    )
  }

  const resolvedTitle =
    typeof title === 'string' ? title.trim() : String(title ?? '')

  if (resolvedTitle.length > LISTING_TITLE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${LISTING_TITLE_MAX_LENGTH} characters or fewer.` },
      { status: 400 },
    )
  }

  // Generate unique slug
  const baseSlug = slugify(resolvedTitle)
  let slug = baseSlug
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('slug', baseSlug)
  if (count) {
    for (let i = 2; i < 100; i++) {
      const candidate = `${baseSlug}-${i}`
      const { count: c } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('slug', candidate)
      if (!c) { slug = candidate; break }
    }
  }

  const modeRaw =
    board_shipping_cost_mode === 'reswell' ||
    board_shipping_cost_mode === 'flat' ||
    board_shipping_cost_mode === 'free'
      ? board_shipping_cost_mode
      : null

  let surfboardShippingCostMode: string | null =
    section === 'surfboards' ? modeRaw : null
  if (section === 'surfboards' && (shipping_available || false)) {
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    const actorIsAdmin = actorProfile?.is_admin === true
    if (!actorIsAdmin) {
      surfboardShippingCostMode = 'reswell'
    } else if (!surfboardShippingCostMode) {
      surfboardShippingCostMode = 'reswell'
    }
  } else if (section === 'surfboards' && !shipping_available) {
    surfboardShippingCostMode = null
  }

  const listingBrandId =
    typeof bodyBrandId === "string" && bodyBrandId.trim() ? bodyBrandId.trim() : null
  const listingBrandModelId =
    typeof bodyBrandModelId === "string" && bodyBrandModelId.trim()
      ? bodyBrandModelId.trim()
      : null
  const listingModelNormalized =
    typeof listingModelText === "string" && listingModelText.trim()
      ? listingModelText.trim()
      : null

  const listingInsertRow = {
    user_id: user.id,
    title: resolvedTitle,
    slug,
    description,
    price: parseFloat(price),
    condition,
    section,
    category_id,
    shipping_available: shipping_available || false,
    local_pickup: local_pickup !== false,
    shipping_price:
      section === 'surfboards' &&
      (surfboardShippingCostMode === 'reswell' || surfboardShippingCostMode === 'free')
        ? 0
        : shipping_price
          ? parseFloat(shipping_price)
          : null,
    board_shipping_cost_mode: surfboardShippingCostMode,
    city,
    state,
    board_type,
    dimensions:
      listingDimensionsColumnTrim(dimensions) ??
      composeListingDimensionsFromSplitListingFields({
        length_feet,
        length_inches,
        length_inches_display,
        width,
        width_inches_display,
        thickness,
        thickness_inches_display,
        volume,
        volume_display,
      }),
    brand,
    shaper,
    brand_id: listingBrandId,
    brand_model_id: listingBrandModelId,
    model: listingModelNormalized,
  }
  let { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert(listingInsertRow)
    .select('id')
    .single()

  if (listingError && isListingDimensionDisplaySchemaCacheError(listingError)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[api/listings] Retrying insert without legacy dimension payload keys.')
    }
    const retry = await supabase
      .from('listings')
      .insert(withoutListingDimensionDisplayDbFields(listingInsertRow as Record<string, unknown>))
      .select('id')
      .single()
    listing = retry.data
    listingError = retry.error
  }

  if (listingError) {
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }

  // Add images (url string or { url, thumbnail_url } for newer clients)
  if (images.length > 0) {
    const imageInserts = images.map(
      (entry: string | { url: string; thumbnail_url?: string | null }, index: number) => {
        const url = typeof entry === 'string' ? entry : entry.url
        const thumbnail_url =
          typeof entry === 'string' ? null : entry.thumbnail_url ?? null
        return {
          listing_id: listing.id,
          url,
          thumbnail_url,
          is_primary: index === 0,
          sort_order: index,
        }
      },
    )

    await supabase.from('listing_images').insert(imageInserts)
  }

  try {
    await syncListingToIndex(supabase, listing.id)
  } catch {
    // ES optional; listing still created
  }

  void syncListingToGoogleMerchantBestEffort(supabase, listing.id)

  const firstEntry = images[0] as
    | string
    | { url: string; thumbnail_url?: string | null }
    | undefined
  const photoUrl =
    typeof firstEntry === "string"
      ? firstEntry
      : firstEntry && typeof firstEntry === "object"
        ? firstEntry.thumbnail_url?.trim() || firstEntry.url
        : null

  void trackKlaviyoListingCreated({
    sellerUserId: user.id,
    sellerEmail: user.email ?? null,
    listingId: listing.id,
    title: resolvedTitle,
    price: parseFloat(String(price)),
    photoUrl: photoUrl || null,
    localPickup: local_pickup !== false,
    shippingAvailable: shipping_available || false,
  })
  void trackFirstTimeSellerForListingIfNeeded(supabase, {
    listingId: listing.id,
    sellerUserId: user.id,
    sellerEmail: user.email ?? null,
  })
  void notifyBoardSavedSearchMatchesForListing(listing.id)
  void notifyFollowersNewListingKlaviyo(listing.id)

  if (section === 'surfboards') {
    revalidateBoardsBrowseCatalog()
  }
  await revalidateSellersAfterListingChange(supabase, user.id)
  revalidateNavSearchSuggest()
  await qualifyPublishedListingForGiveaways(
    supabase,
    listing.id,
    user.id,
    user.email ?? null,
  )

  return NextResponse.json({ success: true, listing_id: listing.id })
}
