import type { SupabaseClient } from "@supabase/supabase-js"

function shippingLines(shipping: Record<string, unknown> | null): string[] {
  if (!shipping) return []
  const name = typeof shipping.name === "string" ? shipping.name.trim() : ""
  const phone = typeof shipping.phone === "string" ? shipping.phone.trim() : ""
  const email = typeof shipping.email === "string" ? shipping.email.trim() : ""
  const rawAddr = shipping.address
  const addr =
    rawAddr && typeof rawAddr === "object" && !Array.isArray(rawAddr)
      ? (rawAddr as Record<string, string | null | undefined>)
      : null

  const lines: string[] = ["", "Ship to:"]
  if (name) lines.push(name)
  if (addr?.line1?.trim()) lines.push(addr.line1.trim())
  if (addr?.line2?.trim()) lines.push(addr.line2.trim())
  const cityState = [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", ").trim()
  if (cityState) lines.push(cityState)
  if (addr?.country?.trim()) lines.push(addr.country.trim().toUpperCase())
  if (phone) lines.push(`Phone: ${phone}`)
  if (email) lines.push(`Email: ${email}`)
  return lines
}

/**
 * Opens or reuses the listing thread and posts a buyer message with payment + fulfillment details
 * so the seller sees the order in Messages without emailing infrastructure.
 */
export async function postPurchaseThreadNotification(
  supabase: SupabaseClient,
  params: {
    buyerId: string
    sellerId: string
    listingId: string
    listingTitle: string
    total: number
    fulfillment: "pickup" | "shipping"
    shippingAddress: Record<string, unknown> | null
  }
): Promise<void> {
  const { buyerId, sellerId, listingId, listingTitle, total, fulfillment, shippingAddress } = params

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (!conversation) {
    const { data: created, error: convError } = await supabase
      .from("conversations")
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
      })
      .select("id")
      .single()

    if (convError || !created) {
      console.error("[purchase notification] conversation insert failed:", convError)
      return
    }
    conversation = created
  }

  const intro = `I paid with card for "${listingTitle}" — $${total.toFixed(2)} total.`
  const fulfillmentLine =
    fulfillment === "shipping"
      ? "Fulfillment: please ship to the address I entered at checkout (also saved on your sale record)."
      : "Fulfillment: local pickup — reply here when you’re free to meet."

  const shipBlock = fulfillment === "shipping" ? shippingLines(shippingAddress).join("\n") : ""
  const content = [intro, "", fulfillmentLine, shipBlock].filter(Boolean).join("\n").trim()

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: buyerId,
    content,
  })

  if (msgError) {
    console.error("[purchase notification] message insert failed:", msgError)
    return
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)
}
