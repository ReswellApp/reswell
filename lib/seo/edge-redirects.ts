import { NextResponse, type NextRequest } from "next/server"

/**
 * Admin-managed 301/302 redirects (table `seo_redirects`) resolved at the edge from `proxy.ts`.
 *
 * Enabled redirects are loaded from Supabase REST with the anon key (RLS exposes only
 * `enabled = true` rows) and cached in module memory with a short TTL so the DB is hit at most
 * once per {@link CACHE_TTL_MS} per edge instance — not on every request.
 */

const CACHE_TTL_MS = 60_000

type RedirectEntry = { to: string; status: number }

let cache: { at: number; map: Map<string, RedirectEntry> } | null = null
let inflight: Promise<Map<string, RedirectEntry>> | null = null

async function fetchRedirects(): Promise<Map<string, RedirectEntry>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const map = new Map<string, RedirectEntry>()
  if (!url || !key) return map

  try {
    const res = await fetch(
      `${url}/rest/v1/seo_redirects?select=from_path,to_path,status_code&enabled=eq.true`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // Manage freshness via CACHE_TTL_MS rather than the data cache.
        cache: "no-store",
      },
    )
    if (!res.ok) return map
    const rows = (await res.json()) as { from_path: string; to_path: string; status_code: number }[]
    for (const row of rows) {
      map.set(row.from_path, { to: row.to_path, status: row.status_code })
    }
  } catch {
    /* network/edge failure: serve no redirects rather than erroring the request */
  }
  return map
}

async function getRedirectMap(): Promise<Map<string, RedirectEntry>> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.map
  if (inflight) return inflight
  inflight = fetchRedirects()
    .then((map) => {
      cache = { at: Date.now(), map }
      return map
    })
    .finally(() => {
      inflight = null
    })
  // Serve a stale cache while the refresh runs to avoid latency spikes.
  if (cache) {
    void inflight
    return cache.map
  }
  return inflight
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "")
  return pathname
}

/**
 * Returns a redirect response if the request path matches an enabled redirect, else `null`
 * (so the caller continues the normal request pipeline).
 */
export async function resolveSeoRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl
  const map = await getRedirectMap()
  if (map.size === 0) return null

  const match = map.get(pathname) ?? map.get(normalizePathname(pathname))
  if (!match) return null

  // Absolute URLs pass through; internal paths keep the incoming query string.
  let destination: string
  if (/^https?:\/\//i.test(match.to)) {
    destination = match.to
  } else {
    const target = request.nextUrl.clone()
    target.pathname = match.to
    target.search = search
    destination = target.toString()
  }

  return NextResponse.redirect(destination, match.status)
}
