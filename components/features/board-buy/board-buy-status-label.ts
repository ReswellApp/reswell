import type { BoardBuyStatus } from "@/lib/board-buy/constants"

export function boardBuyStatusLabel(status: BoardBuyStatus): string {
  switch (status) {
    case "submitted":
      return "Waiting on Reswell"
    case "quoted":
      return "Quote ready"
    case "auto_quoted":
      return "Automatic quote"
    case "declined":
      return "Declined"
    case "accepted":
      return "Accepted — label next"
    case "label_ready":
      return "Ship it"
    case "received":
      return "Received"
    case "paid":
      return "Paid to wallet"
    case "withdrawn":
      return "Withdrawn"
    default:
      return status
  }
}
