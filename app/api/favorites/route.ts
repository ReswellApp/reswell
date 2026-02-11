import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { listing_id } = await request.json()

  if (!listing_id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listing_id)
    .single()

  if (existing) {
    // Remove favorite
    await supabase
      .from('favorites')
      .delete()
      .eq('id', existing.id)

    return NextResponse.json({ success: true, favorited: false })
  } else {
    // Add favorite
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, listing_id })

    if (error) {
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
    }

    return NextResponse.json({ success: true, favorited: true })
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const listing_id = url.searchParams.get('listing_id')

  if (listing_id) {
    // Check if specific listing is favorited
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listing_id)
      .single()

    return NextResponse.json({ favorited: !!data })
  }

  // Get all favorites
  const { data: favorites } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id)

  return NextResponse.json({ favorites: favorites?.map(f => f.listing_id) || [] })
}
