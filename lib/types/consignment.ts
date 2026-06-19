/** Shared shapes for the consignment-store domain (Phase 1a foundation). */

export type ConsignmentStoreStatus = "active" | "paused"

export type ConsignmentStoreStaffRole = "owner" | "manager" | "clerk"

export type ConsignmentIntakeStatus =
  | "pending_approval"
  | "active"
  | "rejected"
  | "withdrawn"

export type OrderSalesChannel = "online" | "pos" | "off_platform"

export interface ConsignmentStore {
  id: string
  slug: string
  name: string
  ownerProfileId: string
  defaultCommissionBps: number
  reswellFeeBps: number
  stripeTerminalLocationId: string | null
  intakeQrToken: string | null
  requireIntakeToken: boolean
  status: ConsignmentStoreStatus
  createdAt: string
  updatedAt: string
}

export interface ConsignmentStoreStaff {
  id: string
  storeId: string
  profileId: string
  role: ConsignmentStoreStaffRole
  createdAt: string
}

export interface StoreCustomer {
  id: string
  storeId: string
  firstName: string
  lastName: string | null
  email: string
  phoneE164: string | null
  profileId: string | null
  createdAt: string
  updatedAt: string
}

/** Consignment attribution attached to a `listings` row (null on ordinary peer listings). */
export interface ListingConsignmentFields {
  consignmentStoreId: string | null
  consignorProfileId: string | null
  intakeStatus: ConsignmentIntakeStatus | null
  consignorProposedPrice: number | null
  floorPrice: number | null
  commissionBps: number | null
  shopSku: string | null
  barcode: string | null
}
