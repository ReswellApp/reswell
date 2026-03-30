import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminDb = createServiceRoleClient()

  const { data: claims, error } = await adminDb
    .from('purchase_protection_claims')
    .select(
      `
      id,
      order_id,
      buyer_id,
      seller_id,
      claim_type,
      status,
      claimed_amount,
      approved_amount,
      denial_reason,
      fraud_flags,
      payout_method,
      created_at,
      reviewed_at,
      paid_at,
      purchases (
        id,
        amount,
        fulfillment_method,
        listings ( id, title )
      ),
      buyer:profiles!purchase_protection_claims_buyer_id_fkey ( display_name ),
      seller:profiles!purchase_protection_claims_seller_id_fkey ( display_name )
    `
    )
    .order('status', { ascending: true }) // PENDING first (alphabetically before others)
    .order('created_at', { ascending: true }) // oldest first within status

  if (error) {
    return NextResponse.json({ error: 'Failed to load claims.' }, { status: 500 })
  }

  // Fund balance
  const { data: fund } = await adminDb
    .from('seller_protection_fund')
    .select('balance, last_updated')
    .single()

  return NextResponse.json({ claims: claims ?? [], fund })
}
