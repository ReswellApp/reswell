export type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'COUNTERED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'COMPLETED'

export type OfferRole = 'BUYER' | 'SELLER'

export type OfferAction =
  | 'OFFER'
  | 'COUNTER'
  | 'ACCEPT'
  | 'DECLINE'
  | 'WITHDRAW'
  | 'MESSAGE'

export interface Offer {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  status: OfferStatus
  initial_amount: number
  current_amount: number
  counter_count: number
  expires_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface OfferMessage {
  id: string
  offer_id: string
  sender_id: string
  sender_role: OfferRole
  action: OfferAction
  amount: number | null
  note: string | null
  created_at: string
}

export interface OfferSettings {
  id: string
  listing_id: string
  offers_enabled: boolean
  minimum_offer_pct: number
  auto_decline_below: number | null
  auto_accept_above: number | null
  created_at: string
  updated_at: string
}

/** Offer joined with listing + buyer/seller profiles for display */
export interface OfferWithContext extends Offer {
  listings: {
    id: string
    title: string
    slug: string | null
    price: number
    section: string
    listing_images: Array<{ url: string; is_primary: boolean | null }> | null
  } | null
  buyer_profile: {
    id: string
    display_name: string | null
    avatar_url: string | null
  } | null
  seller_profile: {
    id: string
    display_name: string | null
    avatar_url: string | null
  } | null
  offer_messages: OfferMessage[]
}

/** Payload for POST /api/offers */
export interface CreateOfferPayload {
  listing_id: string
  seller_id: string
  amount: number
  note?: string
}

/** Payload for PATCH /api/offers/[id] */
export interface RespondToOfferPayload {
  action: 'ACCEPT' | 'DECLINE' | 'COUNTER' | 'WITHDRAW'
  amount?: number
  note?: string
}

/** Active offer status for a buyer on a specific listing */
export interface BuyerListingOfferState {
  offer: Offer | null
  offersEnabled: boolean
  minimumOfferPct: number
}

/** Category-based offer range hints */
export const CATEGORY_OFFER_HINTS: Record<string, { label: string; range: string }> = {
  'surfboards':           { label: 'Boards',        range: '60–80% of asking' },
  'wetsuits':             { label: 'Wetsuits',       range: '70–85% of asking' },
  'fins':                 { label: 'Fins',           range: '75–90% of asking' },
  'leashes':              { label: 'Leashes',        range: '75–90% of asking' },
  'backpacks':            { label: 'Bags',           range: '65–85% of asking' },
  'board-bags':           { label: 'Board bags',     range: '65–85% of asking' },
  'collectibles-vintage': { label: 'Collectibles',   range: '60–80% of asking' },
}

/** Condition-based offer hint text */
export const CONDITION_OFFER_HINTS: Record<string, string> = {
  'like_new':  'Offers around 80–90% are common for excellent-condition gear',
  'good':      'Offers around 70–80% are common for good condition gear',
  'fair':      'Offers around 55–70% are common for fair condition gear',
  'poor':      'Offers around 45–60% are common for well-used gear',
}

export const ACTIVE_OFFER_STATUSES: OfferStatus[] = ['PENDING', 'COUNTERED', 'ACCEPTED']

export function isOfferActive(status: OfferStatus): boolean {
  return ACTIVE_OFFER_STATUSES.includes(status)
}

export function offerStatusLabel(status: OfferStatus): string {
  const labels: Record<OfferStatus, string> = {
    PENDING:   'Pending',
    ACCEPTED:  'Accepted',
    DECLINED:  'Declined',
    COUNTERED: 'Countered',
    EXPIRED:   'Expired',
    WITHDRAWN: 'Withdrawn',
    COMPLETED: 'Completed',
  }
  return labels[status] ?? status
}
