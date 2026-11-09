/** Buyer-facing status for the shop widget. Never a JSON dump. */
export function shopBrowseStatus(count: number, query: string): string {
  const label = query.trim()
  const noun = count === 1 ? "board" : "boards"
  if (!label) return `${count} ${noun}.`
  return `${count} ${noun} for “${label}”.`
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Compact lines for the model. The widget renders cards from structured listings. */
export function shopListingLines(listings: unknown[]): string {
  return listings
    .map((raw) => {
      if (!raw || typeof raw !== "object") return ""
      const row = raw as Record<string, unknown>
      const urls =
        row.urls && typeof row.urls === "object" ? (row.urls as Record<string, unknown>) : null
      const price =
        typeof row.price_usd === "number" && Number.isFinite(row.price_usd)
          ? `$${Math.round(row.price_usd).toLocaleString("en-US")}`
          : ""
      const parts = [
        textField(row.title) || "Surfboard",
        price,
        textField(row.condition_label),
        textField(row.dimensions),
        textField(urls?.html),
      ].filter(Boolean)
      return parts.join(" — ")
    })
    .filter(Boolean)
    .join("\n")
}
