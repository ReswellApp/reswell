import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RespondToOfferPayload } from '@/lib/offers/types'

const MAX_COUNTERS = 3

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json() as RespondToOfferPayload
  const { action, amount, note } = body

  if (!action) {
    return NextResponse.json({ error: 'Missing action.' }, { status: 400 })
  }

  // Load the offer
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select(`
      *,
      listings (id, title, slug, price, section, user_id)
    `)
    .eq('id', id)
    .single()

  if (offerErr || !offer) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }

  const isBuyer = offer.buyer_id === user.id
  const isSeller = offer.seller_id === user.id

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const listing = Array.isArray(offer.listings) ? offer.listings[0] : offer.listings
  const askingPrice = listing ? Number(listing.price) : 0

  // ── WITHDRAW (buyer only, while PENDING) ──────────────────────────
  if (action === 'WITHDRAW') {
    if (!isBuyer) {
      return NextResponse.json({ error: 'Only the buyer can withdraw an offer.' }, { status: 403 })
    }
    if (!['PENDING', 'COUNTERED'].includes(offer.status)) {
      return NextResponse.json({ error: 'This offer cannot be withdrawn.' }, { status: 400 })
    }

    await supabase
      .from('offers')
      .update({ status: 'WITHDRAWN', updated_at: new Date().toISOString() })
      .eq('id', id)

    await supabase.from('offer_messages').insert({
      offer_id: id,
      sender_id: user.id,
      sender_role: 'BUYER',
      action: 'WITHDRAW',
      note: note?.trim() || null,
    })

    await supabase.from('notifications').insert({
      user_id: offer.seller_id,
      type: 'offer_withdrawn',
      listing_id: offer.listing_id,
      actor_id: user.id,
      message: `Buyer withdrew their offer of $${Number(offer.current_amount).toFixed(2)} on "${listing?.title}"`,
    })

    return NextResponse.json({ success: true, status: 'WITHDRAWN' })
  }

  // ── ACCEPT ────────────────────────────────────────────────────────
  if (action === 'ACCEPT') {
    // Buyer can accept a COUNTERED offer; seller can accept a PENDING offer
    const canAccept =
      (isBuyer && offer.status === 'COUNTERED') ||
      (isSeller && offer.status === 'PENDING')

    if (!canAccept) {
      return NextResponse.json({ error: 'Offer cannot be accepted in its current state.' }, { status: 400 })
    }

    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('offers')
      .update({
        status: 'ACCEPTED',
        expires_at: paymentDeadline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    await supabase.from('offer_messages').insert({
      offer_id: id,
      sender_id: user.id,
      sender_role: isBuyer ? 'BUYER' : 'SELLER',
      action: 'ACCEPT',
      amount: offer.current_amount,
    })

    // Mark listing as pending_sale
    await supabase
      .from('listings')
      .update({ status: 'pending_sale' })
      .eq('id', offer.listing_id)

    // Notify the other party
    const notifyUserId = isBuyer ? offer.seller_id : offer.buyer_id
    await supabase.from('notifications').insert({
      user_id: isBuyer ? offer.buyer_id : offer.buyer_id,
      type: 'offer_accepted',
      listing_id: offer.listing_id,
      actor_id: user.id,
      message: `Your offer of $${Number(offer.current_amount).toFixed(2)} on "${listing?.title}" was accepted! Complete your purchase within 24 hours.`,
    })

    // Notify buyer specifically
    if (isSeller) {
      await supabase.from('notifications').insert({
        user_id: offer.buyer_id,
        type: 'offer_accepted',
        listing_id: offer.listing_id,
        actor_id: user.id,
        message: `Your offer of $${Number(offer.current_amount).toFixed(2)} on "${listing?.title}" was accepted! Complete your purchase within 24 hours.`,
      }).then(() => {})
    }

    void notifyUserId

    return NextResponse.json({
      success: true,
      status: 'ACCEPTED',
      agreedAmount: offer.current_amount,
      listingSlug: listing?.slug ?? offer.listing_id,
      listingSection: listing?.section ?? 'used',
    })
  }

  // ── DECLINE ───────────────────────────────────────────────────────
  if (action === 'DECLINE') {
    const canDecline =
      (isSeller && ['PENDING', 'COUNTERED'].includes(offer.status)) ||
      (isBuyer && offer.status === 'COUNTERED')

    if (!canDecline) {
      return NextResponse.json({ error: 'Offer cannot be declined in its current state.' }, { status: 400 })
    }

    await supabase
      .from('offers')
      .update({ status: 'DECLINED', updated_at: new Date().toISOString() })
      .eq('id', id)

    await supabase.from('offer_messages').insert({
      offer_id: id,
      sender_id: user.id,
      sender_role: isBuyer ? 'BUYER' : 'SELLER',
      action: 'DECLINE',
      note: note?.trim() || null,
    })

    // Notify the buyer
    await supabase.from('notifications').insert({
      user_id: offer.buyer_id,
      type: 'offer_declined',
      listing_id: offer.listing_id,
      actor_id: user.id,
      message: `Your offer on "${listing?.title}" was declined.${note ? ` Seller said: "${note}"` : ''}`,
    })

    return NextResponse.json({ success: true, status: 'DECLINED' })
  }

  // ── COUNTER ───────────────────────────────────────────────────────
  if (action === 'COUNTER') {
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Counter amount is required.' }, { status: 400 })
    }

    const canCounter =
      (isSeller && ['PENDING', 'COUNTERED'].includes(offer.status)) ||
      (isBuyer && offer.status === 'COUNTERED')

    if (!canCounter) {
      return NextResponse.json({ error: 'Cannot counter in current state.' }, { status: 400 })
    }

    // Max 3 counters total
    if (offer.counter_count >= MAX_COUNTERS) {
      return NextResponse.json({
        error: 'Maximum counter-offer limit reached. The negotiation is closed.',
      }, { status: 400 })
    }

    // Seller counter must be between buyer's current offer and asking price
    if (isSeller) {
      if (amount >= askingPrice) {
        return NextResponse.json({
          error: "Counter must be below the asking price. If you're happy with the asking price, just decline.",
        }, { status: 400 })
      }
      if (amount <= Number(offer.current_amount)) {
        return NextResponse.json({
          error: "Counter must be above the buyer's current offer.",
        }, { status: 400 })
      }
    }

    // Buyer counter must be above the seller's current counter
    if (isBuyer) {
      if (amount > askingPrice) {
        return NextResponse.json({ error: 'Counter cannot exceed the asking price.' }, { status: 400 })
      }
      if (amount < askingPrice * 0.5) {
        return NextResponse.json({ error: 'Offers must be at least 50% of the asking price.' }, { status: 400 })
      }
    }

    const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('offers')
      .update({
        status: 'COUNTERED',
        current_amount: amount,
        counter_count: offer.counter_count + 1,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    await supabase.from('offer_messages').insert({
      offer_id: id,
      sender_id: user.id,
      sender_role: isBuyer ? 'BUYER' : 'SELLER',
      action: 'COUNTER',
      amount,
      note: note?.trim() || null,
    })

    // Notify the other party
    const notifyId = isBuyer ? offer.seller_id : offer.buyer_id
    const notifType = isBuyer ? 'offer_received' : 'offer_countered'
    const whoLabel = isBuyer ? 'Buyer' : 'Seller'

    await supabase.from('notifications').insert({
      user_id: notifyId,
      type: notifType,
      listing_id: offer.listing_id,
      actor_id: user.id,
      message: `${whoLabel} countered at $${amount.toFixed(2)} on "${listing?.title}"`,
    })

    return NextResponse.json({ success: true, status: 'COUNTERED', newAmount: amount })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .select(`
      *,
      listings (id, title, slug, price, section, listing_images (url, is_primary)),
      offer_messages (*)
    `)
    .eq('id', id)
    .single()

  if (error || !offer) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }

  if (offer.buyer_id !== user.id && offer.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  return NextResponse.json({ offer })
}
