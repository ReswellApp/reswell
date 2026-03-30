import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateOfferPayload } from '@/lib/offers/types'

const HARD_FLOOR_PCT = 0.5   // absolute minimum: 50% of asking
const MAX_ACTIVE_OFFERS = 5  // buyer spam prevention

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to make an offer.' }, { status: 401 })
  }

  const body = await req.json() as CreateOfferPayload
  const { listing_id, seller_id, amount, note } = body

  if (!listing_id || !seller_id || !amount) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (user.id === seller_id) {
    return NextResponse.json({ error: "You can't make an offer on your own listing." }, { status: 400 })
  }

  // Load listing
  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select('id, price, status, user_id, title, slug, section')
    .eq('id', listing_id)
    .single()

  if (listingErr || !listing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 })
  }

  if (listing.status !== 'active') {
    return NextResponse.json({ error: 'This listing is no longer available.' }, { status: 400 })
  }

  if (listing.user_id !== seller_id) {
    return NextResponse.json({ error: 'Invalid seller.' }, { status: 400 })
  }

  const askingPrice = Number(listing.price)

  // Hard floor: 50% of asking
  if (amount < askingPrice * HARD_FLOOR_PCT) {
    return NextResponse.json({
      error: `Offers must be at least 50% of the asking price (${(askingPrice * 0.5).toFixed(2)}).`,
    }, { status: 400 })
  }

  // Cannot offer more than asking price
  if (amount > askingPrice) {
    return NextResponse.json({ error: 'Offer cannot exceed the asking price.' }, { status: 400 })
  }

  // Check offer settings
  const { data: settings } = await supabase
    .from('offer_settings')
    .select('*')
    .eq('listing_id', listing_id)
    .maybeSingle()

  if (settings && !settings.offers_enabled) {
    return NextResponse.json({ error: 'This seller is not accepting offers on this listing.' }, { status: 400 })
  }

  // Check for existing active offer from this buyer
  const { data: existingOffer } = await supabase
    .from('offers')
    .select('id, status')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .in('status', ['PENDING', 'COUNTERED', 'ACCEPTED'])
    .maybeSingle()

  if (existingOffer) {
    return NextResponse.json({
      error: 'You already have an active offer on this listing.',
      offer_id: existingOffer.id,
    }, { status: 409 })
  }

  // 1hr cooldown after a decline on this listing
  const { data: recentDecline } = await supabase
    .from('offers')
    .select('updated_at')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .eq('status', 'DECLINED')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentDecline) {
    const declinedAt = new Date(recentDecline.updated_at)
    const cooldownMs = 60 * 60 * 1000
    if (Date.now() - declinedAt.getTime() < cooldownMs) {
      const minutesLeft = Math.ceil((cooldownMs - (Date.now() - declinedAt.getTime())) / 60000)
      return NextResponse.json({
        error: `You must wait ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''} before making a new offer on this listing.`,
      }, { status: 429 })
    }
  }

  // Rate limit: max 5 active offers across all listings
  const { count: activeCount } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .in('status', ['PENDING', 'COUNTERED'])

  if ((activeCount ?? 0) >= MAX_ACTIVE_OFFERS) {
    return NextResponse.json({
      error: 'You have too many active offers. Withdraw or wait for responses before making more.',
    }, { status: 429 })
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // Auto-decline check
  const minPct = settings?.minimum_offer_pct ?? 70
  const autoDeclineBelow = settings?.auto_decline_below ?? null
  const autoAcceptAbove = settings?.auto_accept_above ?? null

  const belowMinPct = amount < askingPrice * (minPct / 100)
  const belowAutoDecline = autoDeclineBelow !== null && amount < Number(autoDeclineBelow)
  const aboveAutoAccept = autoAcceptAbove !== null && amount >= Number(autoAcceptAbove)

  let initialStatus = 'PENDING'
  let autoMessage: string | null = null

  if (belowMinPct || belowAutoDecline) {
    initialStatus = 'DECLINED'
    autoMessage = `This offer was automatically declined. Try an offer closer to the asking price of $${askingPrice.toFixed(2)}.`
  } else if (aboveAutoAccept) {
    initialStatus = 'ACCEPTED'
  }

  // Create the offer
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .insert({
      listing_id,
      buyer_id: user.id,
      seller_id,
      status: initialStatus,
      initial_amount: amount,
      current_amount: amount,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (offerErr || !offer) {
    console.error('offer insert error:', offerErr)
    return NextResponse.json({ error: 'Failed to create offer.' }, { status: 500 })
  }

  // Create the initial offer message
  await supabase.from('offer_messages').insert({
    offer_id: offer.id,
    sender_id: user.id,
    sender_role: 'BUYER',
    action: 'OFFER',
    amount,
    note: note?.trim() || null,
  })

  // Notify seller (unless auto-handled)
  if (initialStatus === 'PENDING') {
    await supabase.from('notifications').insert({
      user_id: seller_id,
      type: 'offer_received',
      listing_id,
      actor_id: user.id,
      message: `New offer of $${amount.toFixed(2)} on "${listing.title}"`,
    })
  }

  if (initialStatus === 'ACCEPTED') {
    // Notify buyer their offer was auto-accepted
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'offer_accepted',
      listing_id,
      actor_id: seller_id,
      message: `Your offer of $${amount.toFixed(2)} on "${listing.title}" was automatically accepted!`,
    })

    // Mark listing as pending sale
    await supabase
      .from('listings')
      .update({ status: 'pending_sale' })
      .eq('id', listing_id)
  }

  return NextResponse.json({
    offer,
    status: initialStatus,
    autoMessage,
    listingSlug: listing.slug ?? listing.id,
    listingSection: listing.section,
  }, { status: 201 })
}
