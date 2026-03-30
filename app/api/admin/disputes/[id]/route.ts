import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RETURN_WAIVER_MAX_VALUE, RETURN_SHIP_WINDOW_DAYS } from '@/lib/disputes/constants'
import type { AdminActionPayload } from '@/lib/disputes/types'

type Params = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/disputes/[id] — Full dispute detail for admin
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
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

  const { data: dispute, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      purchases (
        id,
        amount,
        fulfillment_method,
        stripe_checkout_session_id,
        listings ( id, title, slug, section, price, condition )
      )
    `
    )
    .eq('id', id)
    .single()

  if (error || !dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })
  }

  const [
    { data: messages },
    { data: evidence },
    { data: flags },
    { data: buyerProfile },
    { data: sellerProfile },
  ] = await Promise.all([
    supabase
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_flags')
      .select('*')
      .eq('dispute_id', id),
    supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .eq('id', dispute.buyer_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .eq('id', dispute.seller_id)
      .single(),
  ])

  // Buyer dispute history (last 10)
  const { data: buyerHistory } = await supabase
    .from('disputes')
    .select('id, reason, status, created_at, resolved_at')
    .eq('buyer_id', dispute.buyer_id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Seller dispute history
  const { data: sellerHistory } = await supabase
    .from('disputes')
    .select('id, reason, status, created_at, resolved_at')
    .eq('seller_id', dispute.seller_id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    dispute,
    messages: messages ?? [],
    evidence: evidence ?? [],
    flags: flags ?? [],
    buyer: buyerProfile,
    seller: sellerProfile,
    buyer_history: buyerHistory ?? [],
    seller_history: sellerHistory ?? [],
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/disputes/[id] — Admin resolution actions
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
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

  const { data: dispute, error: fetchError } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })
  }

  const body = (await req.json()) as AdminActionPayload

  // ── Admin message helper ──────────────────────────────────────────────────

  async function postAdminMessage(message: string) {
    await supabase.from('dispute_messages').insert({
      dispute_id: id,
      sender_id: user!.id,
      sender_role: 'ADMIN',
      message,
    })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  if (body.action === 'APPROVE_FULL_REFUND_WITH_RETURN') {
    const returnDeadline = new Date(
      Date.now() + RETURN_SHIP_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )

    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'RETURN_REQUESTED',
        return_required: true,
        deadline_at: returnDeadline.toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    await postAdminMessage(
      'Reswell has reviewed your dispute and approved a full refund. A prepaid return label has been emailed to the buyer. The refund will be released after the seller confirms receipt of the item.'
    )

    await supabase.from('notifications').insert([
      {
        user_id: dispute.buyer_id,
        type: 'dispute_return_label_sent',
        data: { dispute_id: id },
      },
      {
        user_id: dispute.seller_id,
        type: 'dispute_escalated',
        data: { dispute_id: id },
      },
    ])

    return NextResponse.json({ status: 'RETURN_REQUESTED' })
  }

  if (body.action === 'APPROVE_PARTIAL') {
    const { approved_amount, waive_return, admin_notes } = body

    if (!approved_amount || approved_amount <= 0) {
      return NextResponse.json({ error: 'Invalid approved amount.' }, { status: 400 })
    }

    const newStatus = waive_return ? 'RESOLVED_KEEP_ITEM' : 'RETURN_REQUESTED'

    const { error } = await supabase
      .from('disputes')
      .update({
        status: newStatus,
        approved_amount,
        return_required: !waive_return,
        admin_notes: admin_notes ?? null,
        ...(waive_return
          ? { resolved_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    await postAdminMessage(
      waive_return
        ? `Reswell has approved a partial refund of $${approved_amount.toFixed(2)}. No return is required. The buyer may keep the item.`
        : `Reswell has approved a partial refund of $${approved_amount.toFixed(2)}. A return label is being sent to the buyer.`
    )

    await supabase.from('notifications').insert({
      user_id: dispute.buyer_id,
      type: 'dispute_escalated',
      data: { dispute_id: id, approved_amount },
    })

    return NextResponse.json({ status: newStatus })
  }

  if (body.action === 'CLOSE_SELLER_FAVOR') {
    const { admin_notes } = body

    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'RESOLVED_NO_REFUND',
        admin_notes: admin_notes ?? null,
        resolved_at: new Date().toISOString(),
        resolution_notes: 'Dispute reviewed by Reswell team. Closed in seller\'s favor — no refund issued.',
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    await postAdminMessage(
      'After reviewing all evidence and order history, Reswell has closed this dispute in the seller\'s favor. No refund will be issued.'
    )

    await Promise.all([
      supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_resolved',
        data: { dispute_id: id, outcome: 'CLOSED_NO_REFUND' },
      }),
      supabase.from('notifications').insert({
        user_id: dispute.seller_id,
        type: 'dispute_resolved',
        data: { dispute_id: id, outcome: 'CLOSED_YOUR_FAVOR' },
      }),
    ])

    return NextResponse.json({ status: 'RESOLVED_NO_REFUND' })
  }

  if (body.action === 'WAIVE_RETURN_APPROVE_REFUND') {
    const { approved_amount, admin_notes } = body

    if (!admin_notes?.trim()) {
      return NextResponse.json(
        { error: 'Admin notes are required when waiving the return requirement.' },
        { status: 400 }
      )
    }

    // Only allowed for low-value items or verified-unsalvageable
    const orderAmount = Number(dispute.claimed_amount)
    const isLowValue = orderAmount <= RETURN_WAIVER_MAX_VALUE
    if (!isLowValue) {
      // Admin can still waive but it gets flagged
      await supabase.from('dispute_flags').insert({
        dispute_id: id,
        flag_type: `return_waiver_high_value:${orderAmount}_by_admin:${user.id}`,
      })
    }

    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'RESOLVED_REFUND',
        approved_amount,
        return_required: false,
        admin_notes,
        resolved_at: new Date().toISOString(),
        resolution_notes: 'Return requirement waived by Reswell admin. Refund issued.',
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    await postAdminMessage(
      `Reswell has approved your refund of $${approved_amount.toFixed(2)}. The return requirement has been waived. Your refund will arrive in 3–5 business days.`
    )

    await supabase.from('notifications').insert({
      user_id: dispute.buyer_id,
      type: 'dispute_refund_released',
      data: { dispute_id: id, approved_amount },
    })

    return NextResponse.json({ status: 'RESOLVED_REFUND' })
  }

  if (body.action === 'MARK_RETURN_RECEIVED') {
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'RETURN_RECEIVED',
        return_received_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    await postAdminMessage('Return confirmed as received by Reswell team.')

    return NextResponse.json({ status: 'RETURN_RECEIVED' })
  }

  if (body.action === 'RELEASE_REFUND') {
    const { approved_amount } = body

    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'RESOLVED_REFUND',
        approved_amount,
        resolved_at: new Date().toISOString(),
        resolution_notes: 'Refund released by Reswell team.',
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

    // TODO: trigger Stripe refund

    await postAdminMessage(
      `Your refund of $${approved_amount.toFixed(2)} has been released. It will appear on your original payment method within 3–5 business days.`
    )

    await Promise.all([
      supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_refund_released',
        data: { dispute_id: id, approved_amount },
      }),
      supabase.from('notifications').insert({
        user_id: dispute.seller_id,
        type: 'dispute_resolved',
        data: { dispute_id: id, outcome: 'REFUND_ISSUED', approved_amount },
      }),
    ])

    return NextResponse.json({ status: 'RESOLVED_REFUND' })
  }

  // Admin message without state change
  if (body.action === 'POST_MESSAGE') {
    const { message } = body as { action: string; message: string }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required.' }, { status: 400 })
    }
    await postAdminMessage(message.trim())
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
