/**
 * Canonical public origin (no trailing slash) for metadata, sitemaps, email links, and OG URL resolution.
 *
 * **Production default:** `https://reswell.app`
 *
 * Override in Vercel / `.env` with `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` (e.g. `https://reswell.app`).
 * If unset, **`VERCEL_URL`** is used (`https://…vercel.app`) so preview deployments emit correct `og:image` URLs.
 *
 * **Link previews (Messages, Slack, etc.):** Crawlers cannot fetch `http://localhost` on your machine. To test
 * rich previews, use a **public** URL (production, Vercel preview, or ngrok) and set this env to that origin.
 */
export function publicSiteOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  const vercel = process.env.VERCEL_URL?.trim()

  const raw = explicit || (vercel ? `https://${vercel}` : "") || ""
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
