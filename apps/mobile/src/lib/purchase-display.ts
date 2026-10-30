export function purchaseCountLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe === 1 ? "1 purchase" : `${safe} purchases`
}

export function purchaseMatchesQuery(
  item: { listing_title: string; seller_name: string; order_number: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = item.listing_title.toLowerCase()
  const seller = item.seller_name.toLowerCase()
  const order = item.order_number.toLowerCase()
  return title.includes(q) || seller.includes(q) || order.includes(q) || `#${order}`.includes(q)
}

export function formatPurchaseDate(iso: string | null | undefined, style: "medium" | "long" = "medium"): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatPurchaseDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatCompactDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
