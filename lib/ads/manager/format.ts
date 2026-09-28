export function formatAdsMoney(amount: number | null, currency: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "USD"
  try {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    })
  } catch {
    return amount.toFixed(2)
  }
}

export function formatAdsCount(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

export function formatAdsConversions(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 10 ? 0 : 1 })
}

export function formatAdsRatio(value: number | null, style: "percent" | "multiple"): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (style === "percent") {
    return `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
  }
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}×`
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "winner":
      return "Winner"
    case "loser":
      return "Needs work"
    case "learning":
      return "Learning"
    case "paused":
      return "Paused"
    default:
      return "On pace"
  }
}
