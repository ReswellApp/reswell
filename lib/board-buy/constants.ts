export const BOARD_BUY_SLA_MINUTES = 30
export const BOARD_BUY_AUTO_DISCOUNT = 0.2
export const BOARD_BUY_MAX_PHOTOS = 8
export const BOARD_BUY_MIN_PHOTOS = 1
export const BOARD_BUY_MAX_PHOTO_BYTES = 10 * 1024 * 1024

export const BOARD_BUY_DEFAULT_PARCEL = {
  lengthIn: 78,
  widthIn: 22,
  heightIn: 6,
  weightLb: 18,
} as const

export const BOARD_BUY_STATUSES = [
  "submitted",
  "quoted",
  "auto_quoted",
  "declined",
  "accepted",
  "label_ready",
  "received",
  "paid",
  "withdrawn",
] as const

export type BoardBuyStatus = (typeof BOARD_BUY_STATUSES)[number]

export function isQuotedBoardBuyStatus(status: BoardBuyStatus): boolean {
  return status === "quoted" || status === "auto_quoted"
}

export function computeAutoOfferUsd(askingPrice: number): number {
  return Math.round(askingPrice * (1 - BOARD_BUY_AUTO_DISCOUNT) * 100) / 100
}

export function slaDeadlineFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + BOARD_BUY_SLA_MINUTES * 60 * 1000)
}
