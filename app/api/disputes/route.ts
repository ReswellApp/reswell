import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isReturnRequired,
  calculateRefundAmount,
  detectDisputeFraudFlags,
  MIN_DESCRIPTION_CHARS,
  MIN_EVIDENCE_PHOTOS,
  SELLER_RESPONSE_WINDOW_HOURS,
  RETURN_SHIP_WINDOW_DAYS,
  type DisputeReason,
  type DisputeResolution,
} from '@/lib/disputes/constants'
import type { OpenDisputePayload } from '@/lib/disputes/types'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/disputes  — Buyer opens a dispute
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as OpenDisputePayload

  const {
    order_id,
    reason,
    description,
    desired_resolution,
    claimed_amount,
    evidence_urls = [],
    damage_types = [],
    damage_during_shipping,
    confirmed,
  } = body

  // ── Validation ─────────────────────────────────────────────────────────────

  if (!confirmed) {
    return NextResponse.json(
      { error: 'You must confirm the claim is accurate and made in good faith.' },
      { status: 400 }
    )
  }

  const validReasons: DisputeReason[] = [
    'NOT_AS_DESCRIBED',
    'NOT_RECEIVED',
    'DAMAGED',
    'WRONG_ITEM',
    'OTHER',
  ]
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'Invalid dispute reason.' }, { status: 400 })
  }

  if (!description || description.trim().length < MIN_DESCRIPTION_CHARS) {
    return NextResponse.json(
      { error: `Description must be at least ${MIN_DESCRIPTION_CHARS} characters.` },
      { status: 400 }
    )
  }

  // Photos required for all reasons except NOT_RECEIVED
  if (reason !== 'NOT_RECEIVED' && evidence_urls.length < MIN_EVIDENCE_PHOTOS) {
    return NextResponse.json(
      { error: `At least ${MIN_EVIDENCE_PHOTOS} photos are required.` },
      { status: 400 }
    )
  }

  if (typeof claimed_amount !== 'number' || claimed_amount <= 0) {
    return NextResponse.json({ error: 'Claimed amount must be a positive number.' }, { status: 400 })
  }

  // ── Fetch order ────────────────────────────────────────────────────────────

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select(
      'id, buyer_id, seller_id, amount, fulfillment_method, listings(title, slug, section, board_type)'
    )
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (purchase.fulfillment_method === 'pickup') {
    return NextResponse.json(
      { error: 'Local pickup orders are not covered by the dispute system.', ineligible: true },
      { status: 422 }
    )
  }

  // ── One dispute per order ──────────────────────────────────────────────────

  const { data: existing } = await supabase
    .from('disputes')
    .select('id, status')
    .eq('order_id', order_id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A dispute already exists for this order.', existing_dispute_id: existing.id },
      { status: 409 }
    )
  }

  // ── Fraud detection ────────────────────────────────────────────────────────

  const [
    { data: buyerProfile },
    { data: recentCount },
    { data: distinctSellers },
    { data: abandonedReturns },
  ] = await Promise.all([
    supabase.from('profiles').select('created_at').eq('id', user.id).single(),
    supabase.rpc('buyer_disputes_in_90d', { p_buyer_id: user.id }),
    supabase.rpc('buyer_distinct_seller_dispute_count', { p_buyer_id: user.id }),
    supabase.rpc('buyer_abandoned_returns', { p_buyer_id: user.id }),
  ])

  const accountAgeDays = buyerProfile?.created_at
    ? (Date.now() - new Date(buyerProfile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999

  const fraudFlags = detectDisputeFraudFlags({
    recentDisputeCount: (recentCount as number) ?? 0,
    distinctSellerCount: (distinctSellers as number) ?? 0,
    abandonedReturnCount: (abandonedReturns as number) ?? 0,
    trackingShowsDelivered: false, // TODO: integrate with tracking API
    reason,
    orderAmount: Number(purchase.amount),
    claimedAmount: claimed_amount,
    accountAgeDays,
  })

  // Auto-deny buyers under active fraud review (silent)
  const { data: fraudInvestigation } = await supabase
    .from('dispute_flags')
    .select('id')
    .eq('flag_type', 'open_fraud_investigation')
    .in(
      'dispute_id',
      supabase.from('disputes').select('id').eq('buyer_id', user.id)
    )
    .limit(1)
    .maybeSingle()

  if (fraudInvestigation) {
    return NextResponse.json(
      { error: 'Unable to process dispute at this time. Please contact support.' },
      { status: 422 }
    )
  }

  // ── Compute return requirement ─────────────────────────────────────────────

  const returnRequired = isReturnRequired(reason)
  const listing = Array.isArray(purchase.listings)
    ? purchase.listings[0]
    : purchase.listings
  // Determine large item from section (surfboards) or board_type
  const isLargeItem =
    (listing as { section?: string } | null)?.section === 'surfboards' ||
    !!(listing as { board_type?: string } | null)?.board_type

  const deadline = new Date(Date.now() + SELLER_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000)

  // ── Insert dispute ─────────────────────────────────────────────────────────

  const { data: dispute, error: insertError } = await supabase
    .from('disputes')
    .insert({
      order_id,
      buyer_id: user.id,
      seller_id: purchase.seller_id,
      reason,
      status: 'AWAITING_SELLER',
      description: description.trim(),
      desired_resolution,
      claimed_amount,
      return_required: returnRequired,
      is_large_item: isLargeItem,
      damage_types: damage_types.slice(0, 20),
      damage_during_shipping: damage_during_shipping ?? null,
      deadline_at: deadline.toISOString(),
    })
    .select()
    .single()

  if (insertError || !dispute) {
    console.error('[disputes] Insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to open dispute. Please try again.' }, { status: 500 })
  }

  // ── Insert evidence ────────────────────────────────────────────────────────

  if (evidence_urls.length > 0) {
    await supabase.from('dispute_evidence').insert(
      evidence_urls.slice(0, 8).map((url) => ({
        dispute_id: dispute.id,
        uploaded_by: user.id,
        type: 'PHOTO' as const,
        url,
      }))
    )
  }

  // ── Store fraud flags ──────────────────────────────────────────────────────

  if (fraudFlags.length > 0) {
    await supabase.from('dispute_flags').insert(
      fraudFlags.map((flag) => ({ dispute_id: dispute.id, flag_type: flag }))
    )
  }

  // ── Notify seller in-app ───────────────────────────────────────────────────

  await supabase.from('notifications').insert({
    user_id: purchase.seller_id,
    type: 'dispute_opened',
    data: {
      dispute_id: dispute.id,
      order_id,
      listing_title: (listing as { title?: string } | null)?.title ?? 'Order',
    },
  })

  return NextResponse.json(
    {
      dispute_id: dispute.id,
      status: 'AWAITING_SELLER',
      return_required: returnRequired,
      message:
        'Your dispute has been opened. The seller has 48 hours to respond.',
    },
    { status: 201 }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/disputes  — List buyer's disputes (or seller's if role param)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') ?? 'buyer'

  const filterCol = role === 'seller' ? 'seller_id' : 'buyer_id'

  const { data: disputes, error } = await supabase
    .from('disputes')
    .select(
      `
      id,
      order_id,
      reason,
      status,
      claimed_amount,
      approved_amount,
      return_required,
      return_tracking,
      return_label_url,
      created_at,
      resolved_at,
      deadline_at,
      purchases (
        id,
        amount,
        listings ( title, slug, section )
      )
    `
    )
    .eq(filterCol, user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to load disputes.' }, { status: 500 })
  }

  return NextResponse.json({ disputes: disputes ?? [] })
}
