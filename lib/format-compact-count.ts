/** Compact public stat label (e.g. 1250 → "1.3k+"). */
export function formatCompactCount(value: number): string {
  const n = Math.max(0, Math.trunc(value))
  if (n === 0) return "0"
  if (n >= 1_000_000) {
    const millions = n / 1_000_000
    const rounded = Math.round(millions * 10) / 10
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}M+`
  }
  if (n >= 10_000) {
    return `${Math.floor(n / 1000)}k+`
  }
  if (n >= 1000) {
    const thousands = n / 1000
    const rounded = Math.round(thousands * 10) / 10
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k+`
  }
  if (n >= 100) {
    return `${Math.floor(n / 10) * 10}+`
  }
  return String(n)
}
