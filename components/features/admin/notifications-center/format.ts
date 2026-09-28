export function formatPct(part: number, whole: number): string {
  if (whole <= 0) return "0%"
  return `${Math.round((part / whole) * 1000) / 10}%`
}

export function formatRate(part: number, whole: number): string {
  if (whole <= 0) return "—"
  return formatPct(part, whole)
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}
