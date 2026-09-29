import type { SupabaseClient } from "@supabase/supabase-js"

import { orderUsesSantaBarbaraDropoff } from "@/lib/dropoff-santa-barbara"
import {
  redactShippingLabelArtifactsFromMessage,
  shippingLabelOrderIdFromMessage,
} from "@/lib/messages/redact-seller-shipping-label"

const ORDER_ID_CHUNK = 100

const ORDER_DROPOFF_SELECT = `
  id,
  listings ( dropoff_location_id, dropoff_locations ( slug ) ),
  order_items ( listings ( dropoff_location_id, dropoff_locations ( slug ) ) )
`

type DropoffOrderRow = {
  id: string
} & NonNullable<Parameters<typeof orderUsesSantaBarbaraDropoff>[0]>

/**
 * Order ids whose listing chose Santa Barbara drop-off.
 * Sellers on those orders must not receive label PDFs or QR codes. Admin order
 * tools read the label rows directly and are unaffected.
 */
export async function fetchSantaBarbaraDropoffOrderIds(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  const matched = new Set<string>()
  if (ids.length === 0) return matched

  for (let offset = 0; offset < ids.length; offset += ORDER_ID_CHUNK) {
    const slice = ids.slice(offset, offset + ORDER_ID_CHUNK)
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_DROPOFF_SELECT)
      .in("id", slice)

    if (error) {
      console.error("[santaBarbaraDropoffOrderAccess] orders query:", error.message)
      continue
    }

    for (const row of (data ?? []) as DropoffOrderRow[]) {
      if (row.id && orderUsesSantaBarbaraDropoff(row)) matched.add(row.id)
    }
  }

  return matched
}

type SellerLabelMessage = {
  content?: string | null
  metadata?: unknown
}

/** Strips label downloads from messages whose order used Santa Barbara drop-off. */
export async function redactSantaBarbaraDropoffShippingLabels<T extends SellerLabelMessage>(
  supabase: SupabaseClient,
  messages: T[],
): Promise<{ messages: T[]; hiddenOrderIds: string[] }> {
  const orderIds = messages
    .map((message) => shippingLabelOrderIdFromMessage(message))
    .filter((id): id is string => Boolean(id))
  if (orderIds.length === 0) return { messages, hiddenOrderIds: [] }

  const hidden = await fetchSantaBarbaraDropoffOrderIds(supabase, orderIds)
  if (hidden.size === 0) return { messages, hiddenOrderIds: [] }

  return {
    hiddenOrderIds: [...hidden],
    messages: messages.map((message) => {
      const orderId = shippingLabelOrderIdFromMessage(message)
      if (!orderId || !hidden.has(orderId)) return message
      return redactShippingLabelArtifactsFromMessage(message)
    }),
  }
}
