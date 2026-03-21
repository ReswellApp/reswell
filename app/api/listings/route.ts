import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncListingToIndex } from '@/lib/elasticsearch/listings-index'

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

  // Create listing
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      user_id: user.id,
      title,
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
      length_feet: length_feet ? parseInt(length_feet) : null,
      length_inches: length_inches ? parseInt(length_inches) : null,
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

  // Add images
  if (images.length > 0) {
    const imageInserts = images.map((url: string, index: number) => ({
      listing_id: listing.id,
      url,
      is_primary: index === 0,
      sort_order: index,
    }))

    await supabase.from('listing_images').insert(imageInserts)
  }

  try {
    await syncListingToIndex(supabase, listing.id)
  } catch {
    // ES optional; listing still created
  }

  return NextResponse.json({ success: true, listing_id: listing.id })
}
