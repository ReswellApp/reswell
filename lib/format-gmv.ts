/** Compact GMV for feed stats (USD). */
export function formatGmv(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0"
  if (amount < 1000) return `$${Math.round(amount)}`
  if (amount < 100_000) {
    const k = amount / 1000
    const rounded = Math.round(k * 10) / 10
    const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    return `$${s}k`
  }
  const m = amount / 1_000_000
  const rounded = Math.round(m * 10) / 10
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `$${s}M`
}
