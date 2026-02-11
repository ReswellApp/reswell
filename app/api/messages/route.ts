import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { listing_id, seller_id, content } = body

  if (!seller_id || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Find or create conversation
  let conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('seller_id', seller_id)
    .eq('listing_id', listing_id || null)
    .single()

  if (existingConv) {
    conversation = existingConv
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        buyer_id: user.id,
        seller_id,
        listing_id: listing_id || null,
      })
      .select('id')
      .single()

    if (convError) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversation = newConv
  }

  // Create message
  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content,
  })

  if (msgError) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)

  return NextResponse.json({ success: true, conversation_id: conversation.id })
}
