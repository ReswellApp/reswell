import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slugify'

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

  const baseSlug = slugify(title)
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
      user_id: targetUserId,
      title,
      slug,
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
    const imageInserts = (
      images as (string | { url: string; thumbnail_url?: string | null })[]
    ).map((entry, index: number) => {
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
    })
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

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  const canDelete = isSuperAdmin || profile?.is_admin || profile?.is_employee
  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const listingId = request.nextUrl.searchParams.get('id')?.trim()
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing id' }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error('[admin listings] Missing SUPABASE_SERVICE_ROLE_KEY for delete:', e)
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { error } = await service.from('listings').delete().eq('id', listingId)
  if (error) {
    // Most common blocker: listing is referenced by order_items (FK constraint)
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Listing has related order history and cannot be permanently deleted.' },
        { status: 409 },
      )
    }
    console.error('[admin listings] delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
