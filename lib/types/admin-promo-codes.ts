export type AdminPromoCodeStatusFilter = "all" | "active" | "reserved" | "redeemed" | "expired"

export type AdminPromoCodeSortKey =
  | "created_at"
  | "expires_at"
  | "redeemed_at"
  | "code"
  | "email"

export type AdminPromoCodeListRow = {
  id: string
  email: string
  code: string
  discountPercent: number
  createdAt: string
  expiresAt: string
  redeemedAt: string | null
  reservedPaymentIntentId: string | null
  status: "active" | "reserved" | "redeemed" | "expired"
  order: {
    id: string
    orderNum: string | null
    amount: number
    promoDiscountUsd: number
    status: string
    createdAt: string
  } | null
}

export type AdminPromoCodeStats = {
  totalIssued: number
  active: number
  reserved: number
  redeemed: number
  expired: number
  totalDiscountUsd: number
}

export type AdminPromoCodesListResult = {
  rows: AdminPromoCodeListRow[]
  total: number
  stats: AdminPromoCodeStats
}
