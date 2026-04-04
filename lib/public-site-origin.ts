/**
 * Canonical public origin (no trailing slash) for metadata, sitemaps, email links, and OG URL resolution.
 *
 * **Production default:** `https://reswell.app`
 *
 * Override in Vercel / `.env` with `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` (e.g. `https://reswell.app`).
 * Used by Stripe/checkout code paths via the same env vars; keep them consistent for callbacks.
 */
export function publicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return "https://reswell.app"
  try {
    const normalized = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw.replace(/^\/+/, "")}`
    const u = new URL(normalized)
    return `${u.protocol}//${u.host}`
  } catch {
    return "https://reswell.app"
  }
}
