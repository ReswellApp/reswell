export type AdminListingViewsPeriod = "7d" | "30d" | "all"

export type AdminListingViewsSummary = {
  uniqueViewers: number
  distinctListings: number
  totalViewEvents: number
}

export type AdminListingViewRow = {
  userId: string
  userDisplayName: string | null
  userEmail: string | null
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingStatus: string
  listingSection: string
  viewCount: number
  firstViewedAt: string
  lastViewedAt: string
}

export type AdminListingViewsDashboard = {
  period: AdminListingViewsPeriod
  summary: AdminListingViewsSummary
  rows: AdminListingViewRow[]
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
}
