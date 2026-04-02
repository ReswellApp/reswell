/**
 * Canonical public origin for PayPal OAuth redirect_uri (must match Developer Dashboard).
 */
export function getPayPalPublicAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  return raw.replace(/\/$/, "")
}
