import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'haydensbsb@gmail.com'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!isSuperAdmin || !profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    user_id: targetUserId,
    title,
    description,
    price,
    condition,
    section,
    category_id,
    shipping_available,
    local_pickup,
    shipping_price,
    city,
    state,
    board_type,
    length_feet,
    length_inches,
    width,
    thickness,
    volume,
    brand,
    shaper,
    images = [],
    inventory_quantity,
  } = body

  if (!targetUserId || !title || !description || price == null || !section || !category_id) {
    return NextResponse.json(
      { error: 'Missing required fields: user_id, title, description, price, section, category_id' },
      { status: 400 }
    )
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      user_id: targetUserId,
      title,
      description,
      price: parseFloat(price),
      condition: condition || null,
      section,
      category_id,
      shipping_available: shipping_available || false,
      local_pickup: local_pickup !== false,
      shipping_price: shipping_price ? parseFloat(shipping_price) : null,
      city: city || null,
      state: state || null,
      board_type: board_type || null,
      length_feet: length_feet ? parseInt(length_feet) : null,
      length_inches: length_inches ? parseInt(length_inches) : null,
      width: width ? parseFloat(width) : null,
      thickness: thickness ? parseFloat(thickness) : null,
      volume: volume ? parseFloat(volume) : null,
      brand: brand || null,
      shaper: shaper || null,
    })
    .select('id')
    .single()

  if (listingError) {
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }

  if (images.length > 0) {
    const imageInserts = images.map((url: string, index: number) => ({
      listing_id: listing.id,
      url,
      is_primary: index === 0,
      sort_order: index,
    }))
    await supabase.from('listing_images').insert(imageInserts)
  }

  if (section === 'new' && inventory_quantity != null && Number(inventory_quantity) > 0) {
    await supabase.from('inventory').insert({
      listing_id: listing.id,
      quantity: parseInt(String(inventory_quantity), 10),
    })
  }

  return NextResponse.json({ success: true, listing_id: listing.id })
}
