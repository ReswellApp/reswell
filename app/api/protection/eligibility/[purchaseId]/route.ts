import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isProtectionWindowActive,
  daysRemainingInWindow,
  type ProtectionEligibility,
} from '@/lib/protection-constants'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the purchase belongs to this buyer
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, buyer_id, status, fulfillment_method, stripe_checkout_session_id')
    .eq('id', purchaseId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  }

  // Fetch eligibility record
  const { data: eligibility } = await supabase
    .from('protection_eligibility')
    .select('*')
    .eq('order_id', purchaseId)
    .maybeSingle()

  if (!eligibility) {
    // No eligibility record yet — derive it dynamically
    const isLocalPickup = purchase.fulfillment_method === 'pickup'
    const isPaidThroughReswell = true // All purchases in DB were through Reswell

    if (isLocalPickup) {
      return NextResponse.json({
        is_eligible: false,
        reason: 'Local pickup orders are not covered. Protection requires tracked shipping.',
        days_remaining: 0,
        window_closes: null,
      })
    }

    if (!isPaidThroughReswell) {
      return NextResponse.json({
        is_eligible: false,
        reason: 'Only orders paid through Reswell are covered.',
        days_remaining: 0,
        window_closes: null,
      })
    }

    // No delivery confirmation yet — window not started
    return NextResponse.json({
      is_eligible: true,
      reason: null,
      days_remaining: 30,
      window_closes: null,
      note: 'Window starts when delivery is confirmed.',
    })
  }

  const active = isProtectionWindowActive(eligibility.window_closes)
  const daysLeft = daysRemainingInWindow(eligibility.window_closes)

  // Check for existing claim on this order
  const { data: existingClaim } = await supabase
    .from('purchase_protection_claims')
    .select('id, status')
    .eq('order_id', purchaseId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    is_eligible: eligibility.is_eligible && active,
    reason: !active
      ? 'The 30-day protection window has closed for this order.'
      : eligibility.reason,
    days_remaining: daysLeft,
    window_closes: eligibility.window_closes,
    existing_claim: existingClaim
      ? { id: existingClaim.id, status: existingClaim.status }
      : null,
  } satisfies {
    is_eligible: boolean
    reason: string | null
    days_remaining: number
    window_closes: string | null
    existing_claim: { id: string; status: string } | null
  })
}
