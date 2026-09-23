export const BOARD_ARCHIVE_PAGE_SIZE = 40

export type BoardArchiveStatus = "active" | "sold" | "pending" | "pending_sale" | string

export interface BoardArchiveRow {
  id: string
  listingId: string
  title: string
  href: string
  status: BoardArchiveStatus
  statusLabel: string
  priceLabel: string | null
  brandName: string
  modelName: string
  dimensions: string | null
  variantSummary: string | null
  listingImageIds: string[]
  photoCount: number
  thumbnailUrl: string | null
  createdAt: string
}

export interface BoardArchivePage {
  rows: BoardArchiveRow[]
  page: number
  pageSize: number
  total: number
  catalogTotal: number
  withVariant: number
  withPhoto: number
  query: string
}
