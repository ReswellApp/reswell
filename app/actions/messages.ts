"use server"

import { createClient } from "@/lib/supabase/server"

export async function sendListingMessage(input: {
  listing_id?: string | null
  seller_id: string
  content: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const { listing_id, seller_id, content } = input

  if (!seller_id || !content) {
    return { error: "Missing required fields" as const }
  }

  let conversation
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_id", seller_id)
    .eq("listing_id", listing_id || null)
    .single()

  if (existingConv) {
    conversation = existingConv
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        buyer_id: user.id,
        seller_id,
        listing_id: listing_id || null,
      })
      .select("id")
      .single()

    if (convError) {
      return { error: "Failed to create conversation" as const }
    }
    conversation = newConv
  }

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content,
  })

  if (msgError) {
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  return { success: true as const, conversation_id: conversation.id }
}
