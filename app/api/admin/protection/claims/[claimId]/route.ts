import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  calculateApprovedAmount,
  PROTECTION_FUND_MINIMUM_RESERVE,
  type ClaimType,
} from '@/lib/protection-constants'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { action, approved_amount, denial_reason, payout_method } = body as {
    action: 'approve' | 'deny'
    approved_amount?: number
    denial_reason?: string
    payout_method?: string
  }

  const adminDb = createServiceRoleClient()

  // Fetch claim + purchase details
  const { data: claim, error: claimError } = await adminDb
    .from('purchase_protection_claims')
    .select(
      `
      id,
      status,
      claim_type,
      claimed_amount,
      order_id,
      purchases ( id, amount, fulfillment_method )
    `
    )
    .eq('id', claimId)
    .single()

  if (claimError || !claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })
  }

  if (claim.status !== 'PENDING' && claim.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Only PENDING or APPROVED claims can be updated.' },
      { status: 400 }
    )
  }

  if (action === 'approve') {
    const purchase = Array.isArray(claim.purchases) ? claim.purchases[0] : claim.purchases

    // Auto-calculate approved amount using coverage cap logic
    const finalApprovedAmount =
      approved_amount ??
      calculateApprovedAmount(
        claim.claim_type as ClaimType,
        Number(claim.claimed_amount),
        Number(purchase?.amount ?? 0),
        0 // shipping cost — use 0 if not tracked separately
      )

    // Check protection fund balance before approving
    const { data: fund } = await adminDb
      .from('seller_protection_fund')
      .select('id, balance')
      .single()

    if (!fund) {
      return NextResponse.json({ error: 'Protection fund not found.' }, { status: 500 })
    }

    if (fund.balance - finalApprovedAmount < PROTECTION_FUND_MINIMUM_RESERVE) {
      return NextResponse.json(
        {
          error: `Fund balance too low. Current: $${fund.balance.toFixed(2)}. Payout: $${finalApprovedAmount.toFixed(2)}. Reserve required: $${PROTECTION_FUND_MINIMUM_RESERVE}.`,
          fund_low: true,
        },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()

    // Update the claim
    const { error: updateError } = await adminDb
      .from('purchase_protection_claims')
      .update({
        status: 'APPROVED',
        approved_amount: finalApprovedAmount,
        payout_method: payout_method ?? 'ORIGINAL_PAYMENT',
        reviewed_at: now,
        reviewed_by: user.id,
      })
      .eq('id', claimId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update claim.' }, { status: 500 })
    }

    // Deduct from protection fund
    const { error: fundError } = await adminDb
      .from('seller_protection_fund')
      .update({
        balance: fund.balance - finalApprovedAmount,
        last_updated: now,
      })
      .eq('id', fund.id)

    if (fundError) {
      console.error('[admin/protection] Failed to deduct from fund:', fundError)
    }

    return NextResponse.json({
      message: `Claim approved. $${finalApprovedAmount.toFixed(2)} approved for refund.`,
      approved_amount: finalApprovedAmount,
    })
  }

  if (action === 'deny') {
    if (!denial_reason?.trim()) {
      return NextResponse.json(
        { error: 'A denial reason is required.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await adminDb
      .from('purchase_protection_claims')
      .update({
        status: 'DENIED',
        denial_reason: denial_reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', claimId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update claim.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Claim denied.' })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
