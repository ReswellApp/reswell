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
