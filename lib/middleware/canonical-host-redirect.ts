import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { canonicalProductionSiteHostname } from "@/lib/public-site-origin"

/** Hostnames served in production (align with Vercel domain aliases). */
const RESWELL_HOST_ALIASES = new Set(["reswell.app", "www.reswell.app"])

function hasExplicitProductionSiteUrl(): boolean {
  const v =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  return Boolean(v)
}

/**
 * Production edge redirects for Reswell hosts:
 *
 * - **HTTP → HTTPS** on `reswell.app` / `www.reswell.app`, preserving the requested hostname (same host, TLS).
 * - **www ↔ apex** normalization runs **only** when `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` is set.
 *   Without that, we defer www vs apex to **Vercel’s primary domain** so we never fight the platform
 *   (e.g. middleware apex + Vercel “redirect to www” causes ERR_TOO_MANY_REDIRECTS).
 */
export function canonicalHostRedirectResponse(request: NextRequest): NextResponse | null {
  const rawHost = request.headers.get("host")?.split(":")[0]?.toLowerCase()
  if (!rawHost || !RESWELL_HOST_ALIASES.has(rawHost)) {
    return null
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()
  const isHttp = forwardedProto === "http"

  const url = request.nextUrl.clone()
  const pathAndQuery = `${url.pathname}${url.search}`

  if (isHttp) {
    const target = new URL(pathAndQuery, `https://${rawHost}`)
    return NextResponse.redirect(target, 308)
  }

  if (!hasExplicitProductionSiteUrl()) {
    return null
  }

  const canonicalHost = canonicalProductionSiteHostname()
  if (rawHost === canonicalHost) {
    return null
  }

  const target = new URL(pathAndQuery, `https://${canonicalHost}`)
  return NextResponse.redirect(target, 308)
}
