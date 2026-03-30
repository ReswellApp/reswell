import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: claim, error } = await supabase
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      claim_type,
      status,
      description,
      claimed_amount,
      approved_amount,
      payout_method,
      denial_reason,
      evidence_urls,
      seller_response,
      seller_responded_at,
      reviewed_at,
      paid_at,
      created_at,
      purchases (
        id,
        amount,
        fulfillment_method,
        listings ( id, title, slug, section, listing_images ( url, is_primary ) )
      )
    `
    )
    .eq('id', claimId)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (error || !claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })
  }

  // Strip fraud_flags — never expose to buyer or seller
  return NextResponse.json({ claim })
}

// Seller responds to claim
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action, seller_response } = body as {
    action: 'accept' | 'respond' | 'withdraw'
    seller_response?: string
  }

  // Fetch the claim
  const { data: claim, error } = await supabase
    .from('purchase_protection_claims')
    .select('id, status, seller_id, buyer_id')
    .eq('id', claimId)
    .maybeSingle()

  if (error || !claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })
  }

  // Seller accepting or responding
  if (claim.seller_id === user.id) {
    if (action === 'accept') {
      // Seller accepts → auto-approve
      const { error: updateError } = await supabase
        .from('purchase_protection_claims')
        .update({
          status: 'APPROVED',
          seller_response: seller_response ?? 'Seller accepted the claim.',
          seller_responded_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update claim.' }, { status: 500 })
      }
      return NextResponse.json({ message: 'Claim accepted. Refund will be processed.' })
    }

    if (action === 'respond') {
      const { error: updateError } = await supabase
        .from('purchase_protection_claims')
        .update({
          seller_response: seller_response,
          seller_responded_at: new Date().toISOString(),
        })
        .eq('id', claimId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to save response.' }, { status: 500 })
      }
      return NextResponse.json({ message: 'Response submitted. Our team will review within 3 business days.' })
    }
  }

  // Buyer withdrawing
  if (claim.buyer_id === user.id && action === 'withdraw') {
    if (claim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending claims can be withdrawn.' },
        { status: 400 }
      )
    }
    const { error: updateError } = await supabase
      .from('purchase_protection_claims')
      .update({ status: 'WITHDRAWN' })
      .eq('id', claimId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to withdraw claim.' }, { status: 500 })
    }
    return NextResponse.json({ message: 'Claim withdrawn.' })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
