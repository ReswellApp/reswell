import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REPORT_REASONS = [
  'spam',
  'inappropriate',
  'scam',
  'fake',
  'harassment',
  'other',
] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, listing_id, reported_user_id, reason, description } = body

  if (!reason || !REPORT_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: 'Valid reason is required (spam, inappropriate, scam, fake, harassment, other)' },
      { status: 400 }
    )
  }

  if (type === 'listing') {
    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id required when reporting a listing' }, { status: 400 })
    }
    const { data: listing } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listing_id)
      .single()
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      listing_id: listing.id,
      reported_user_id: null,
      reason,
      description: description || null,
    })
    if (error) {
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (type === 'user') {
    if (!reported_user_id) {
      return NextResponse.json({ error: 'reported_user_id required when reporting a user' }, { status: 400 })
    }
    if (reported_user_id === user.id) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', reported_user_id)
      .single()
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      listing_id: null,
      reported_user_id,
      reason,
      description: description || null,
    })
    if (error) {
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'type must be "listing" or "user"' }, { status: 400 })
}
