import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SELLER_CONFIRM_RECEIPT_DAYS, RETURN_SHIP_WINDOW_DAYS } from '@/lib/disputes/constants'
import type {
  BuyerActionPayload,
  SellerRespondPayload,
  SellerReturnActionPayload,
} from '@/lib/disputes/types'

type Params = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/disputes/[id]  — Dispute detail (buyer or seller)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dispute, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      orders (
        id,
        amount,
        listings ( title, slug, section )
      )
    `
    )
    .eq('id', id)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (error || !dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })
  }

  const [{ data: messages }, { data: evidence }] = await Promise.all([
    supabase
      .from('dispute_messages')
      .select('id, sender_id, sender_role, message, attachments, created_at')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_evidence')
      .select('id, uploaded_by, type, url, caption, created_at')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({ dispute, messages: messages ?? [], evidence: evidence ?? [] })
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/disputes/[id]  — Dispute actions (buyer, seller)
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dispute, error: fetchError } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })
  }

  const isBuyer = dispute.buyer_id === user.id
  const isSeller = dispute.seller_id === user.id

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body as { action: string }

  // ── Seller actions ─────────────────────────────────────────────────────────

  if (isSeller) {
    const payload = body as SellerRespondPayload | SellerReturnActionPayload

    if (action === 'ACCEPT_RETURN') {
      // Seller accepts dispute + requests item return
      const returnDeadline = new Date(
        Date.now() + RETURN_SHIP_WINDOW_DAYS * 24 * 60 * 60 * 1000
      )

      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'RETURN_REQUESTED',
          return_required: true,
          // In production: call EasyPost/ShipStation to generate label
          // return_label_url: generatedLabelUrl,
          deadline_at: returnDeadline.toISOString(),
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_return_label_sent',
        data: { dispute_id: id },
      })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'SELLER',
        message: 'I accept the dispute. Please return the item using the prepaid label that has been sent to your email.',
      })

      return NextResponse.json({ status: 'RETURN_REQUESTED' })
    }

    if (action === 'PROPOSE_PARTIAL') {
      const { partial_amount } = payload as { action: string; partial_amount: number }
      if (!partial_amount || partial_amount <= 0) {
        return NextResponse.json({ error: 'Invalid partial amount.' }, { status: 400 })
      }

      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'AWAITING_BUYER',
          seller_partial_amount: partial_amount,
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_seller_responded',
        data: { dispute_id: id, partial_amount },
      })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'SELLER',
        message: `I'd like to propose a partial refund of $${Number(partial_amount).toFixed(2)}. You would keep the item.`,
      })

      return NextResponse.json({ status: 'AWAITING_BUYER' })
    }

    if (action === 'DISPUTE_CLAIM') {
      const { counter_message } = payload as { action: string; counter_message: string }
      if (!counter_message?.trim()) {
        return NextResponse.json({ error: 'Counter message required.' }, { status: 400 })
      }

      const { error } = await supabase
        .from('disputes')
        .update({ status: 'AWAITING_BUYER' })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'SELLER',
        message: counter_message.trim(),
      })

      await supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_seller_responded',
        data: { dispute_id: id },
      })

      return NextResponse.json({ status: 'AWAITING_BUYER' })
    }

    if (action === 'CONFIRM_RETURN_ACCEPTABLE') {
      // Seller confirms item received, triggers refund
      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'RESOLVED_REFUND',
          return_received_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Item returned and received in acceptable condition. Refund released.',
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      // TODO: trigger Stripe refund via approved_amount

      await supabase.from('notifications').insert({
        user_id: dispute.buyer_id,
        type: 'dispute_refund_released',
        data: { dispute_id: id, approved_amount: dispute.claimed_amount },
      })

      return NextResponse.json({ status: 'RESOLVED_REFUND' })
    }

    if (action === 'FLAG_RETURN_CONDITION') {
      const { message } = payload as { action: string; message: string }

      const { error } = await supabase
        .from('disputes')
        .update({ status: 'UNDER_REVIEW' })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'SELLER',
        message: message?.trim() ?? 'I received the item but it does not match what the buyer described.',
      })

      return NextResponse.json({ status: 'UNDER_REVIEW' })
    }
  }

  // ── Buyer actions ──────────────────────────────────────────────────────────

  if (isBuyer) {
    const payload = body as BuyerActionPayload

    if (action === 'ADD_TRACKING') {
      const { tracking_number } = payload as { action: string; tracking_number: string }
      if (!tracking_number?.trim()) {
        return NextResponse.json({ error: 'Tracking number required.' }, { status: 400 })
      }

      const autoConfirmDeadline = new Date(
        Date.now() + SELLER_CONFIRM_RECEIPT_DAYS * 24 * 60 * 60 * 1000
      )

      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'RETURN_SHIPPED',
          return_tracking: tracking_number.trim(),
          return_shipped_at: new Date().toISOString(),
          deadline_at: autoConfirmDeadline.toISOString(),
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      // Notify seller
      await supabase.from('notifications').insert({
        user_id: dispute.seller_id,
        type: 'dispute_return_shipped',
        data: { dispute_id: id, tracking_number: tracking_number.trim() },
      })

      return NextResponse.json({ status: 'RETURN_SHIPPED' })
    }

    if (action === 'ACCEPT_PARTIAL') {
      const { partial_amount } = payload as { action: string; partial_amount: number }
      if (!dispute.seller_partial_amount) {
        return NextResponse.json({ error: 'No partial offer to accept.' }, { status: 400 })
      }

      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'RESOLVED_KEEP_ITEM',
          approved_amount: partial_amount ?? dispute.seller_partial_amount,
          resolved_at: new Date().toISOString(),
          resolution_notes: `Both parties agreed to a partial refund of $${Number(dispute.seller_partial_amount).toFixed(2)}.`,
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      // TODO: trigger Stripe partial refund

      await supabase.from('notifications').insert({
        user_id: dispute.seller_id,
        type: 'dispute_resolved',
        data: {
          dispute_id: id,
          outcome: 'PARTIAL_AGREED',
          approved_amount: dispute.seller_partial_amount,
        },
      })

      return NextResponse.json({ status: 'RESOLVED_KEEP_ITEM' })
    }

    if (action === 'REJECT_PARTIAL') {
      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'AWAITING_SELLER',
          seller_partial_amount: null,
        })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'BUYER',
        message: 'I have declined the partial refund proposal.',
      })

      return NextResponse.json({ status: 'AWAITING_SELLER' })
    }

    if (action === 'ESCALATE') {
      const { error } = await supabase
        .from('disputes')
        .update({ status: 'UNDER_REVIEW' })
        .eq('id', id)

      if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id: user.id,
        sender_role: 'BUYER',
        message: 'I have escalated this dispute to the Reswell team for review.',
      })

      // Notify both parties and flag for admin
      await Promise.all([
        supabase.from('notifications').insert({
          user_id: dispute.seller_id,
          type: 'dispute_escalated',
          data: { dispute_id: id },
        }),
        supabase.from('dispute_flags').insert({
          dispute_id: id,
          flag_type: 'buyer_escalated',
        }),
      ])

      return NextResponse.json({ status: 'UNDER_REVIEW' })
    }
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
