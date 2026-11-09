/**
 * Whole-dollar GMV for public stats (sold feed, about, sales map).
 * Grouped thousands stay stable between the server and the browser.
 * Example: 100750 → "$100,750".
 */
export function formatGmv(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0"
  return Math.round(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
