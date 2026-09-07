export type AddedToCartPreview = {
  listingId: string
  title: string
  imageUrl: string | null
  priceUsd: number | null
  /** Quantity of this listing in the cart after the add. */
  lineQuantity: number
  /** Units added in this action (heading copy). */
  addedQuantity: number
  cartCount: number
  checkoutHref: string
}

export function cartFromCartCheckoutHref(sellerId: string): string {
  const q = new URLSearchParams()
  q.set("from_cart", "1")
  q.set("seller_id", sellerId)
  return `/checkout?${q.toString()}`
}

export function addedToCartHeading(addedQuantity: number): string {
  const n = Math.max(1, Math.floor(addedQuantity))
  if (n === 1) return "Ok, 1 item was added to your cart. What's next?"
  return `Ok, ${n} items were added to your cart. What's next?`
}

export function formatAddedToCartMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function shouldOpenAddedToCartDialog(pathname: string | null | undefined): boolean {
  if (!pathname) return true
  if (pathname === "/cart" || pathname.startsWith("/cart/")) return false
  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) return false
  return true
}

export function cartItemCountFromQuantities(rows: { quantity?: number | null }[] | null | undefined): number {
  return (rows ?? []).reduce(
    (sum, row) => sum + Math.max(1, Math.floor(Number(row.quantity) || 1)),
    0,
  )
}
