/**
 * Fixed two-decimal USD labels.
 * Explicit fraction digits stay stable between the server and the browser.
 */
export function formatUsd(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
