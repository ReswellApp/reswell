import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/disputes/[id]/messages — Send a message in a dispute thread
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, buyer_id, seller_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 })

  const isBuyer = dispute.buyer_id === user.id
  const isSeller = dispute.seller_id === user.id

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resolvedStatuses = ['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED']
  if (resolvedStatuses.includes(dispute.status)) {
    return NextResponse.json({ error: 'This dispute is closed.' }, { status: 409 })
  }

  const body = await req.json()
  const { message, attachments = [] } = body as { message: string; attachments?: string[] }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 })
  }

  const senderRole = isBuyer ? 'BUYER' : 'SELLER'

  const { data: msg, error } = await supabase
    .from('dispute_messages')
    .insert({
      dispute_id: id,
      sender_id: user.id,
      sender_role: senderRole,
      message: message.trim(),
      attachments: (attachments as string[]).slice(0, 4),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 })
  }

  // Notify the other party
  const recipientId = isBuyer ? dispute.seller_id : dispute.buyer_id
  if (recipientId) {
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'dispute_seller_responded',
      data: { dispute_id: id },
    })
  }

  return NextResponse.json({ message: msg }, { status: 201 })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/disputes/[id]/messages
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dispute } = await supabase
    .from('disputes')
    .select('buyer_id, seller_id')
    .eq('id', id)
    .maybeSingle()

  if (!dispute) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (dispute.buyer_id !== user.id && dispute.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { data: messages } = await supabase
    .from('dispute_messages')
    .select('id, sender_id, sender_role, message, attachments, created_at')
    .eq('dispute_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}
