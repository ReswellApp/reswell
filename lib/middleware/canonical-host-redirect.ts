import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { canonicalProductionSiteHostname } from "@/lib/public-site-origin"

/** Hostnames served in production (align with Vercel domain aliases). */
const RESWELL_HOST_ALIASES = new Set(["reswell.app", "www.reswell.app"])

/**
 * Permanent redirect to canonical HTTPS hostname (`NEXT_PUBLIC_SITE_URL` host, else `reswell.app`).
 * Ensures `http://reswell.app/…` and `https://www.reswell.app/…` consolidate for indexing.
 */
export function canonicalHostRedirectResponse(request: NextRequest): NextResponse | null {
  const rawHost = request.headers.get("host")?.split(":")[0]?.toLowerCase()
  if (!rawHost || !RESWELL_HOST_ALIASES.has(rawHost)) {
    return null
  }

  const canonicalHost = canonicalProductionSiteHostname()
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()
  const isHttp = forwardedProto === "http"

  const url = request.nextUrl.clone()
  const pathAndQuery = `${url.pathname}${url.search}`

  const needsHostNormalization = rawHost !== canonicalHost
  const needsHttps = isHttp

  if (!needsHostNormalization && !needsHttps) {
    return null
  }

  const target = new URL(pathAndQuery, `https://${canonicalHost}`)
  return NextResponse.redirect(target, 308)
}
