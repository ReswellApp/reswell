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

/**
 * Derives the canonical production hostname from `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`,
 * defaulting to **`reswell.app`** when unset or invalid.
 *
 * Middleware uses this for **www ↔ apex** redirects **only** when one of those env vars is set.
 * Without them, middleware leaves hostname as-is (HTTPS upgrade still applies), so Vercel’s primary
 * domain is the single source of truth and redirect loops are avoided.
 * Does **not** fall back to `VERCEL_URL` — preview hostnames must never rewrite production domains.
 */
export function canonicalProductionSiteHostname(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) {
    try {
      const normalized = /^https?:\/\//i.test(explicit)
        ? explicit
        : `https://${explicit.replace(/^\/+/, "")}`
      return new URL(normalized).hostname.toLowerCase()
    } catch {
      /* fall through */
    }
  }
  return "reswell.app"
}

/**
 * Canonical origin for **email** links (Klaviyo inactive winback, etc.).
 *
 * Does **not** use `VERCEL_URL`, so cron/jobs from preview deploys won’t emit `*.vercel.app`
 * listing URLs unless you set an explicit app URL below.
 *
 * Precedence: `KLAVIYO_EMAIL_SITE_URL` → `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` → `https://reswell.app`.
 */
export function publicSiteOriginForEmail(): string {
  const raw =
    process.env.KLAVIYO_EMAIL_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
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
