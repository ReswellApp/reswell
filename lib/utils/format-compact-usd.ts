/**
 * Compact USD labels that match on server and client.
 *
 * Avoid `Intl.NumberFormat` with `notation: 'compact'` in SSR — Node and browser ICU
 * data can disagree (e.g. "$11.0K" vs "$11K") and trigger hydration mismatches.
 */
function compactMagnitude(value: number): string {
  if (value >= 100) return String(Math.round(value))
  const oneDecimal = value.toFixed(1)
  return oneDecimal.endsWith('.0') ? oneDecimal.slice(0, -2) : oneDecimal
}

export function formatCompactUsd(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}$${compactMagnitude(abs / 1_000_000_000)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${compactMagnitude(abs / 1_000_000)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${compactMagnitude(abs / 1_000)}K`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  }).format(value)
}
