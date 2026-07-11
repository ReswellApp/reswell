export type AdminIssuedPromoCodeStatusFilter = "all" | "active" | "reserved" | "redeemed" | "expired"

export type AdminIssuedPromoCodeSortKey =
  | "created_at"
  | "expires_at"
  | "redeemed_at"
  | "code"
  | "discount_percent"

export type AdminIssuedPromoCodeListRow = {
  id: string
  code: string
  discountPercent: number
  note: string | null
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

export type AdminIssuedPromoCodeStats = {
  totalIssued: number
  active: number
  reserved: number
  redeemed: number
  expired: number
  totalDiscountUsd: number
}

export type AdminIssuedPromoCodesListResult = {
  rows: AdminIssuedPromoCodeListRow[]
  total: number
  stats: AdminIssuedPromoCodeStats
}

export type AdminIssuedPromoGenerateResult = {
  id: string
  code: string
  discountPercent: number
  note: string | null
  expiresAt: string
  createdAt: string
}
