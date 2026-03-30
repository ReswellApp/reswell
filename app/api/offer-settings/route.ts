import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json()
  const { listing_id, offers_enabled, minimum_offer_pct, auto_accept_above, auto_decline_below } = body

  if (!listing_id) {
    return NextResponse.json({ error: 'listing_id is required.' }, { status: 400 })
  }

  // Verify ownership
  const { data: listing } = await supabase
    .from('listings')
    .select('id, user_id')
    .eq('id', listing_id)
    .single()

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: 'Listing not found or access denied.' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('offer_settings')
    .upsert({
      listing_id,
      offers_enabled: offers_enabled ?? true,
      minimum_offer_pct: minimum_offer_pct ?? 70,
      auto_accept_above: auto_accept_above ?? null,
      auto_decline_below: auto_decline_below ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'listing_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save offer settings.' }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
