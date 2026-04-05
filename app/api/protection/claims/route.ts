import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isProtectionWindowActive,
  detectFraudFlags,
  FRAUD_FLAG_MAX_CLAIMS_90_DAYS,
  MIN_DESCRIPTION_CHARS,
  type ClaimType,
} from '@/lib/protection-constants'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    order_id,
    claim_type,
    description,
    claimed_amount,
    evidence_urls = [],
    confirmed,
  } = body as {
    order_id: string
    claim_type: ClaimType
    description: string
    claimed_amount: number
    evidence_urls?: string[]
    confirmed: boolean
  }

  // ── Validation ────────────────────────────────────────────────

  if (!confirmed) {
    return NextResponse.json(
      { error: 'You must confirm the claim is accurate and made in good faith.' },
      { status: 400 }
    )
  }

  const validClaimTypes: ClaimType[] = [
    'NOT_RECEIVED',
    'NOT_AS_DESCRIBED',
    'DAMAGED',
    'UNAUTHORIZED',
  ]
  if (!validClaimTypes.includes(claim_type)) {
    return NextResponse.json({ error: 'Invalid claim type.' }, { status: 400 })
  }

  if (!description || description.trim().length < MIN_DESCRIPTION_CHARS) {
    return NextResponse.json(
      { error: `Description must be at least ${MIN_DESCRIPTION_CHARS} characters.` },
      { status: 400 }
    )
  }

  if (typeof claimed_amount !== 'number' || claimed_amount <= 0) {
    return NextResponse.json({ error: 'Claimed amount must be a positive number.' }, { status: 400 })
  }

  // ── Fetch purchase ────────────────────────────────────────────

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, amount, fulfillment_method, stripe_checkout_session_id')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  // ── Eligibility checks ────────────────────────────────────────

  // Local pickup is not covered
  if (order.fulfillment_method === 'pickup') {
    return NextResponse.json(
      {
        error:
          'Local pickup orders are not covered by Purchase Protection. Protection requires tracked shipping.',
        ineligible: true,
      },
      { status: 422 }
    )
  }

  // Must be paid through Reswell (all DB purchases are, but belt-and-suspenders)
  if (!order.buyer_id) {
    return NextResponse.json(
      { error: 'Only orders paid through Reswell are covered.', ineligible: true },
      { status: 422 }
    )
  }

  // Check protection window
  const { data: eligibility } = await supabase
    .from('protection_eligibility')
    .select('is_eligible, reason, window_closes')
    .eq('order_id', order_id)
    .maybeSingle()

  if (eligibility) {
    if (!eligibility.is_eligible) {
      return NextResponse.json(
        { error: eligibility.reason ?? 'This order is not eligible for protection.', ineligible: true },
        { status: 422 }
      )
    }
    if (!isProtectionWindowActive(eligibility.window_closes)) {
      return NextResponse.json(
        {
          error: 'The 30-day protection window has closed for this order.',
          ineligible: true,
        },
        { status: 422 }
      )
    }
  }

  // Only one claim per order
  const { data: existingClaim } = await supabase
    .from('purchase_protection_claims')
    .select('id, status')
    .eq('order_id', order_id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existingClaim) {
    return NextResponse.json(
      { error: 'A claim already exists for this order.', existing_claim_id: existingClaim.id },
      { status: 409 }
    )
  }

  // ── Fraud flag detection ──────────────────────────────────────

  // Count claims in the last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentClaimCount } = await supabase
    .from('purchase_protection_claims')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .gte('created_at', ninetyDaysAgo)

  // Fetch buyer profile for account age
  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', user.id)
    .single()

  // Count seller disputes (for "trusted seller" flag)
  const { count: sellerDisputeCount } = await supabase
    .from('purchase_protection_claims')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', order.seller_id)

  const fraudFlags = detectFraudFlags({
    recentClaimCount: recentClaimCount ?? 0,
    accountCreatedAt: buyerProfile?.created_at ?? new Date().toISOString(),
    deliveryConfirmedAt: null, // TODO: pass actual delivery timestamp when tracking is implemented
    claimedAmount: claimed_amount,
    orderAmount: Number(order.amount),
    sellerDisputeCount: sellerDisputeCount ?? 0,
  })

  // Auto-deny if buyer has open fraud investigation (silent)
  const { data: fraudInvestigation } = await supabase
    .from('purchase_protection_claims')
    .select('id')
    .eq('buyer_id', user.id)
    .contains('fraud_flags', ['open_fraud_investigation'])
    .maybeSingle()

  if (fraudInvestigation) {
    return NextResponse.json(
      { error: 'Unable to process claim at this time. Please contact support.' },
      { status: 422 }
    )
  }

  // Flag for admin review if buyer has filed 3+ claims in 90 days
  const requiresManualReview =
    (recentClaimCount ?? 0) >= FRAUD_FLAG_MAX_CLAIMS_90_DAYS || fraudFlags.length > 0

  // ── Insert claim ──────────────────────────────────────────────

  const { data: claim, error: insertError } = await supabase
    .from('purchase_protection_claims')
    .insert({
      order_id,
      buyer_id: user.id,
      seller_id: order.seller_id,
      claim_type,
      status: 'PENDING',
      description: description.trim(),
      claimed_amount,
      evidence_urls: evidence_urls.slice(0, 8), // max 8 files
      fraud_flags: fraudFlags,
    })
    .select()
    .single()

  if (insertError || !claim) {
    console.error('[protection/claims] Insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to file claim. Please try again.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      claim_id: claim.id,
      status: 'PENDING',
      requires_manual_review: requiresManualReview,
      message:
        'Your protection claim has been received. We will review it within 3 business days.',
    },
    { status: 201 }
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: claims, error } = await supabase
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      claim_type,
      status,
      claimed_amount,
      approved_amount,
      denial_reason,
      payout_method,
      created_at,
      reviewed_at,
      paid_at,
      orders (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `
    )
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to load claims.' }, { status: 500 })
  }

  return NextResponse.json({ claims: claims ?? [] })
}
