export function shippingPriceToFormValue(v: unknown): string {
  if (v == null || v === "") return ""
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? String(n) : ""
}
