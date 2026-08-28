import type { BoardBuyStatus } from "@/lib/board-buy/constants"

export interface BoardBuyPhoto {
  id: string
  url: string
  sortOrder: number
}

export interface BoardBuySubmission {
  id: string
  userId: string
  title: string
  askingPrice: number
  offeredPrice: number | null
  quoteSource: "ops" | "auto_sla" | null
  status: BoardBuyStatus
  slaDeadlineAt: string
  quotedAt: string | null
  acceptedAt: string | null
  declinedAt: string | null
  receivedAt: string | null
  paidAt: string | null
  opsNotes: string | null
  sellerNote: string | null
  shipFromName: string
  shipFromPhone: string
  shipFromLine1: string
  shipFromLine2: string | null
  shipFromCity: string
  shipFromState: string
  shipFromPostal: string
  shipFromCountry: string
  parcelLengthIn: number | null
  parcelWidthIn: number | null
  parcelHeightIn: number | null
  parcelWeightLb: number | null
  labelPdfUrl: string | null
  labelId: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  createdAt: string
  updatedAt: string
  photos: BoardBuyPhoto[]
}

export interface BoardBuyAdminListItem extends BoardBuySubmission {
  sellerEmail: string | null
  sellerDisplayName: string | null
}
