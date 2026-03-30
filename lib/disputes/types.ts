/**
 * Reswell Dispute Resolution — TypeScript types.
 * Mirrors the disputes schema defined in scripts/048_disputes.sql.
 */

export type DisputeReason =
  | 'NOT_AS_DESCRIBED'
  | 'NOT_RECEIVED'
  | 'DAMAGED'
  | 'WRONG_ITEM'
  | 'OTHER'

export type DisputeStatus =
  | 'OPEN'
  | 'AWAITING_SELLER'
  | 'AWAITING_BUYER'
  | 'RETURN_REQUESTED'
  | 'RETURN_SHIPPED'
  | 'RETURN_RECEIVED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_REFUND'
  | 'RESOLVED_NO_REFUND'
  | 'RESOLVED_KEEP_ITEM'
  | 'CLOSED'

export type DisputeResolution = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'REPLACEMENT' | 'FLAG_ONLY'

export type DisputeSenderRole = 'BUYER' | 'SELLER' | 'ADMIN'

export type DisputeEvidenceType = 'PHOTO' | 'TRACKING' | 'SCREENSHOT' | 'OTHER'

// ─────────────────────────────────────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────────────────────────────────────

export type Dispute = {
  id: string
  order_id: string | null
  buyer_id: string | null
  seller_id: string | null
  reason: DisputeReason
  status: DisputeStatus
  description: string
  desired_resolution: DisputeResolution
  claimed_amount: number
  approved_amount: number | null
  return_required: boolean
  return_label_url: string | null
  return_tracking: string | null
  return_shipped_at: string | null
  return_received_at: string | null
  is_large_item: boolean
  damage_types: string[]
  damage_during_shipping: string | null
  seller_partial_amount: number | null
  admin_notes: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  deadline_at: string
}

export type DisputeMessage = {
  id: string
  dispute_id: string
  sender_id: string | null
  sender_role: DisputeSenderRole
  message: string
  attachments: string[]
  created_at: string
}

export type DisputeEvidence = {
  id: string
  dispute_id: string
  uploaded_by: string | null
  type: DisputeEvidenceType
  url: string
  caption: string | null
  created_at: string
}

export type DisputeFlag = {
  id: string
  dispute_id: string
  flag_type: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Enriched shapes (with joins)
// ─────────────────────────────────────────────────────────────────────────────

export type DisputeWithOrder = Dispute & {
  order: {
    id: string
    amount: number
    shipping_cost: number | null
    listing_title: string
    listing_slug: string | null
    listing_section: string | null
    listing_image_url: string | null
  } | null
  buyer_name: string | null
  seller_name: string | null
}

export type DisputeDetailView = Dispute & {
  messages: DisputeMessage[]
  evidence: DisputeEvidence[]
  flags: DisputeFlag[]
  order: {
    id: string
    amount: number
    shipping_cost: number | null
    listing_title: string
    listing_slug: string | null
    listing_section: string | null
    listing_image_url: string | null
  } | null
  buyer_name: string | null
  buyer_email: string | null
  seller_name: string | null
  seller_email: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API request/response types
// ─────────────────────────────────────────────────────────────────────────────

export type OpenDisputePayload = {
  order_id: string
  reason: DisputeReason
  description: string
  desired_resolution: DisputeResolution
  claimed_amount: number
  evidence_urls: string[]
  damage_types?: string[]
  damage_during_shipping?: string
  confirmed: boolean
}

export type SellerRespondPayload =
  | { action: 'ACCEPT_RETURN' }
  | { action: 'PROPOSE_PARTIAL'; partial_amount: number }
  | { action: 'DISPUTE_CLAIM'; counter_message: string }
  | { action: 'NO_ACTION' }

export type BuyerActionPayload =
  | { action: 'ADD_TRACKING'; tracking_number: string }
  | { action: 'ACCEPT_PARTIAL'; partial_amount: number }
  | { action: 'REJECT_PARTIAL' }
  | { action: 'ESCALATE' }

export type AdminActionPayload =
  | { action: 'APPROVE_FULL_REFUND_WITH_RETURN' }
  | { action: 'APPROVE_PARTIAL'; approved_amount: number; waive_return: boolean; admin_notes?: string }
  | { action: 'CLOSE_SELLER_FAVOR'; admin_notes?: string }
  | { action: 'WAIVE_RETURN_APPROVE_REFUND'; approved_amount: number; admin_notes: string }
  | { action: 'MARK_RETURN_RECEIVED' }
  | { action: 'RELEASE_REFUND'; approved_amount: number }

export type SellerReturnActionPayload =
  | { action: 'CONFIRM_RETURN_ACCEPTABLE' }
  | { action: 'FLAG_RETURN_CONDITION'; message: string }
