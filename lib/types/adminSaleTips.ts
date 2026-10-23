import type { AdminSaleTipStatus } from "@/lib/admin/sale-tip-filters"

export type AdminSaleTipListItem = {
  id: string
  amountCents: number
  status: AdminSaleTipStatus
  createdAt: string
  succeededAt: string | null
  stripePaymentIntentId: string
  sellerUserId: string
  sellerDisplayName: string | null
  sellerEmail: string | null
  listingId: string
  listingTitle: string | null
  listingSlug: string | null
  listingStatus: string | null
}

export type AdminSaleTipSummary = {
  succeededCount: number
  pendingCount: number
  failedCount: number
  canceledCount: number
  succeededAmountCents: number
  uniqueSucceededSellers: number
}

export type AdminSaleTipSellerFilter = {
  id: string
  displayName: string | null
  email: string | null
}

export type AdminSaleTipDirectory = {
  items: AdminSaleTipListItem[]
  total: number
  page: number
  pageSize: number
  summary: AdminSaleTipSummary
  sellerFilter: AdminSaleTipSellerFilter | null
  filters: {
    status: AdminSaleTipStatus | "all"
    q: string
    sellerUserId: string | null
  }
}

export type AdminUserSaleTip = {
  id: string
  listingId: string
  listingTitle: string | null
  listingSlug: string | null
  amountCents: number
  status: AdminSaleTipStatus
  createdAt: string
  succeededAt: string | null
}
