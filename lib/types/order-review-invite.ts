export type OrderReviewInviteRow = {
  id: string
  order_id: string
  token: string
  buyer_id: string
  seller_id: string
  listing_id: string | null
  post_purchase_sent_at: string | null
  fulfillment_reminder_sent_at: string | null
  created_at: string
}

export type OrderReviewInvitePhase = "post_purchase" | "fulfillment"
