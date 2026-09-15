import { randomBytes } from "node:crypto"

/** Opaque URL-safe token for `/review/[token]` (32 bytes → ~43 chars base64url). */
export function generateOrderReviewInviteToken(): string {
  return randomBytes(24).toString("base64url")
}

export function orderReviewInvitePath(token: string): string {
  return `/review/${encodeURIComponent(token.trim())}`
}

export function orderReviewInviteUrl(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}${orderReviewInvitePath(token)}`
}

/** Buyer purchase page — the working place to leave a seller review. */
export function orderPurchasePath(orderId: string): string {
  return `/dashboard/purchases/${orderId.trim()}`
}

/** Opens the purchase page and prompts the Review seller dialog. */
export function orderPurchaseReviewPath(orderId: string): string {
  return `${orderPurchasePath(orderId)}?review=1`
}

export function decodeOrderReviewInviteToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}
