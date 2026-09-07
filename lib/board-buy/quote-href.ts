export function boardBuyQuotePath(id: string): string {
  return `/we-buy/quotes/${id}`
}

export function boardBuyQuoteRef(id: string): string {
  return `RW-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export function formatBoardBuyUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}
