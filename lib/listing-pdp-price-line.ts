/** Short line beneath list price on peer listings (“+ shipping” style, Reverb-aligned). */

export function peerListingShippingSubline(
  localPickup: boolean | null | undefined,
  shippingAvailable: boolean | null | undefined,
  shippingPrice: number | string | null | undefined,
  boardShippingCostMode?: "reswell" | "flat" | "free" | null,
): string | null {
  const ship = !!shippingAvailable

  if (!ship) return null

  const mode = boardShippingCostMode ?? null
  const n = Math.max(0, Number.parseFloat(String(shippingPrice ?? 0)) || 0)

  if (mode === "free") return "Includes free shipping"
  if (n > 0) return `+ $${n.toFixed(2)} shipping`
  if (mode === "reswell") return "Shipping calculated at checkout"
  return "Shipping options at checkout"
}
