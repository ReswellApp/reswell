export type CarrierClaimStatus =
  | "not_started"
  | "ready_to_file"
  | "filed"
  | "under_review"
  | "approved"
  | "denied"
  | "paid"
  | "withdrawn"

export type SupportEvidenceKind = "damage" | "packing" | "listing_compare" | "other"

export const CARRIER_CLAIM_STATUS_LABEL: Record<CarrierClaimStatus, string> = {
  not_started: "Not started",
  ready_to_file: "Ready to file",
  filed: "Filed",
  under_review: "Under review",
  approved: "Approved",
  denied: "Denied",
  paid: "Paid",
  withdrawn: "Withdrawn",
}

export const SUPPORT_EVIDENCE_KIND_LABEL: Record<SupportEvidenceKind, string> = {
  damage: "Damage",
  packing: "Packing / box",
  listing_compare: "Vs listing",
  other: "Other",
}

/** ShipEngine Carriers / Stamps UPS One Balance loss-damage claim form (not an API). */
export const SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL =
  "https://survey.alchemer.com/s3/7327927/UPS-One-Balance-from-Stamps-Form"

export const PROTECTION_REPAIR_CREDIT_REFERENCE_TYPE = "protection_repair_credit" as const

/** Soft cap: repair credits should not exceed order item total without explicit override. */
export const PROTECTION_REPAIR_CREDIT_MAX_USD = 5000
