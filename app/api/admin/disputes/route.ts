import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/disputes — Admin: list all disputes with queues
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const queue = searchParams.get('queue') // 'fast_track' | 'return_waiver' | 'fraud' | 'all'
  const status = searchParams.get('status')
  const sortBy = searchParams.get('sort') ?? 'deadline_at'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 25
  const offset = (page - 1) * limit

  let query = supabase
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
      return_received_at,
      is_large_item,
      seller_partial_amount,
      admin_notes,
      created_at,
      updated_at,
      resolved_at,
      deadline_at,
      buyer_id,
      seller_id,
      purchases (
        id,
        amount,
        listings ( id, title, slug, section )
      )
    `,
      { count: 'exact' }
    )

  if (status) {
    query = query.eq('status', status)
  } else if (queue === 'fast_track') {
    // NOT_RECEIVED disputes under review — same-day resolution target
    query = query.eq('reason', 'NOT_RECEIVED').in('status', ['AWAITING_SELLER', 'UNDER_REVIEW', 'OPEN'])
  } else if (queue === 'return_waiver') {
    // Damaged items needing admin decision on whether return is worth it
    query = query.eq('reason', 'DAMAGED').eq('status', 'UNDER_REVIEW')
  } else if (queue === 'fraud') {
    // Disputes with fraud flags
    query = query.in('id',
      supabase.from('dispute_flags').select('dispute_id').neq('flag_type', 'buyer_escalated')
    )
  } else {
    // All open disputes
    query = query.not('status', 'in', '(RESOLVED_REFUND,RESOLVED_NO_REFUND,RESOLVED_KEEP_ITEM,CLOSED)')
  }

  if (sortBy === 'deadline_at') {
    query = query.order('deadline_at', { ascending: true })
  } else if (sortBy === 'claimed_amount') {
    query = query.order('claimed_amount', { ascending: false })
  } else if (sortBy === 'created_at') {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: disputes, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to load disputes.' }, { status: 500 })
  }

  // Fetch buyer/seller names for the result set
  const userIds = [
    ...new Set([
      ...(disputes ?? []).map((d) => d.buyer_id),
      ...(disputes ?? []).map((d) => d.seller_id),
    ].filter(Boolean)),
  ]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds as string[])

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const enriched = (disputes ?? []).map((d) => ({
    ...d,
    buyer_name: profileMap[d.buyer_id as string]?.display_name ?? null,
    buyer_email: profileMap[d.buyer_id as string]?.email ?? null,
    seller_name: profileMap[d.seller_id as string]?.display_name ?? null,
    seller_email: profileMap[d.seller_id as string]?.email ?? null,
  }))

  // Queue counts for dashboard header
  const [
    { count: fastTrackCount },
    { count: returnWaiverCount },
    { count: fraudCount },
    { count: openCount },
  ] = await Promise.all([
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('reason', 'NOT_RECEIVED')
      .in('status', ['AWAITING_SELLER', 'UNDER_REVIEW', 'OPEN']),
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('reason', 'DAMAGED')
      .eq('status', 'UNDER_REVIEW'),
    supabase
      .from('dispute_flags')
      .select('*', { count: 'exact', head: true })
      .neq('flag_type', 'buyer_escalated'),
    supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '(RESOLVED_REFUND,RESOLVED_NO_REFUND,RESOLVED_KEEP_ITEM,CLOSED)'),
  ])

  return NextResponse.json({
    disputes: enriched,
    total: count ?? 0,
    page,
    queues: {
      fast_track: fastTrackCount ?? 0,
      return_waiver: returnWaiverCount ?? 0,
      fraud: fraudCount ?? 0,
      open: openCount ?? 0,
    },
  })
}
