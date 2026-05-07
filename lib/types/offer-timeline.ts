/** One structured negotiation step stored in `offers.offer_timeline` (JSONB array). */
export type OfferTimelineEntry = {
  id: string
  sender_id: string
  sender_role: "BUYER" | "SELLER"
  action: string
  amount: number | null
  note: string | null
  created_at: string
}
