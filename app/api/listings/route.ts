import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncListingToIndex } from '@/lib/elasticsearch/listings-index'
import { slugify } from '@/lib/slugify'
import { listingTitleWithBoardLength } from '@/lib/listing-title-board-length'
import { trackKlaviyoListingCreated } from '@/lib/klaviyo/track-listing-created'
import { formatBoardInchesForTitle, LISTING_TITLE_MAX_LENGTH } from '@/lib/sell-form-validation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  if (section === 'used' && (!description || typeof description !== 'string' || !description.trim())) {
    return NextResponse.json(
      { error: 'Description is required for used item listings' },
      { status: 400 }
    )
  }

  const {
    shipping_available,
    local_pickup,
    shipping_price,
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
    images = [],
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

  const feetParsed = length_feet != null && length_feet !== '' ? parseInt(String(length_feet), 10) : NaN
  const inchParsed =
    length_inches != null && length_inches !== '' ? parseFloat(String(length_inches)) : NaN
  const boardLenLabel =
    Number.isFinite(feetParsed) && Number.isFinite(inchParsed)
      ? `${feetParsed}'${formatBoardInchesForTitle(inchParsed)}"`
      : Number.isFinite(feetParsed)
        ? `${feetParsed}'`
        : null
  const resolvedTitle =
    section === 'surfboards' && boardLenLabel
      ? listingTitleWithBoardLength(typeof title === 'string' ? title : '', boardLenLabel)
      : typeof title === 'string'
        ? title.trim()
        : String(title ?? '')

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

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
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
      shipping_price: shipping_price ? parseFloat(shipping_price) : null,
      city,
      state,
      board_type,
      length_feet: length_feet ? parseInt(String(length_feet), 10) : null,
      length_inches:
        length_inches != null && length_inches !== ''
          ? parseFloat(String(length_inches))
          : null,
      width: width ? parseFloat(width) : null,
      thickness: thickness ? parseFloat(thickness) : null,
      volume: volume ? parseFloat(volume) : null,
      brand,
      shaper,
    })
    .select('id')
    .single()

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
  })

  return NextResponse.json({ success: true, listing_id: listing.id })
}
