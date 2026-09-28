/** Currencies Meta bills in major units (no cents). */
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

export function currencyOffset(currency: string): number {
  return ZERO_DECIMAL.has(currency.trim().toUpperCase()) ? 1 : 100
}

/** Google Ads API budgets are integer micros of the account currency. */
export function majorToMicros(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget must be a positive amount")
  }
  return String(Math.round(amount * 1_000_000))
}

export function microsToMajor(micros: string | number | null | undefined): number | null {
  if (micros == null || micros === "") return null
  const value = typeof micros === "number" ? micros : Number(micros)
  if (!Number.isFinite(value)) return null
  return value / 1_000_000
}

/**
 * Meta campaign and ad set `daily_budget` is the currency's minor unit.
 * Insights `spend` is already a major-unit decimal — do not pass it here.
 */
export function majorToMetaMinor(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget must be a positive amount")
  }
  return String(Math.round(amount * currencyOffset(currency)))
}

export function metaMinorToMajor(
  raw: string | number | null | undefined,
  currency: string,
): number | null {
  if (raw == null || raw === "") return null
  const value = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(value)) return null
  return value / currencyOffset(currency)
}

export function parseMajor(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  if (typeof raw === "string" && raw.trim()) {
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
  }
  return 0
}
