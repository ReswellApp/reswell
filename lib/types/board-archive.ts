export const BOARD_ARCHIVE_PAGE_SIZE = 40

export type BoardArchiveStatus = "active" | "sold" | "pending" | "pending_sale" | string

export interface BoardArchiveRow {
  id: string
  listingId: string
  title: string
  href: string
  status: BoardArchiveStatus
  statusLabel: string
  brandName: string
  modelName: string
  dimensions: string | null
  variantSummary: string | null
  listingImageIds: string[]
  photoUrls: string[]
  createdAt: string
}

export interface BoardArchivePage {
  rows: BoardArchiveRow[]
  page: number
  pageSize: number
  total: number
  query: string
}
