/**
 * Client-side cart in localStorage. Checkout validates rows against `listings` (see /api/checkout/cart-session).
 * Dispatches `cartUpdated` so the header badge stays in sync. Checkout: `/checkout` (Stripe success: `/checkout/success`).
 */

export type CartLine = {
  id: string
  name: string
  price: number
  image_url: string | null
  quantity: number
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("cart") || "[]"
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as CartLine[]) : []
  } catch {
    return []
  }
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, i) => sum + (i.quantity ?? 1), 0)
}

export function writeCart(cart: CartLine[]): void {
  localStorage.setItem("cart", JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent("cartUpdated"))
}

export type MergeResult = { ok: true } | { ok: false; reason: "stock" }

export function mergeIntoCart(
  item: Omit<CartLine, "quantity">,
  addQty: number,
  maxStock: number,
): MergeResult {
  const cart = readCart()
  const existingIndex = cart.findIndex((i) => i.id === item.id)

  if (existingIndex >= 0) {
    const nextQty = cart[existingIndex].quantity + addQty
    if (nextQty > maxStock) return { ok: false, reason: "stock" }
    cart[existingIndex].quantity = nextQty
  } else {
    cart.push({ ...item, quantity: addQty })
  }

  writeCart(cart)
  return { ok: true }
}
