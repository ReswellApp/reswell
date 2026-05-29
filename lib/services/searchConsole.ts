import { GoogleAuth } from "google-auth-library"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/**
 * Google Search Console (Search Analytics) integration. Fully optional: every function degrades
 * gracefully and returns an "unconfigured" result when credentials/property are not set, so the
 * admin SEO panel works with or without it.
 *
 * Env:
 * - GOOGLE_SEARCH_CONSOLE_SITE_URL          property, e.g. `sc-domain:reswell.app` or `https://reswell.app/`
 * - GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON  service-account JSON (read access to the property)
 *   (falls back to GOOGLE_APPLICATION_CREDENTIALS if that's how the runtime is configured)
 */

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3"

export interface PageSearchPerformance {
  configured: true
  clicks: number
  impressions: number
  /** 0–1. */
  ctr: number
  /** Average position (lower is better). */
  position: number
  topQueries: { query: string; clicks: number; impressions: number; position: number }[]
  rangeDays: number
}

export interface SearchConsoleUnconfigured {
  configured: false
  reason: string
}

export type SearchConsoleResult = PageSearchPerformance | SearchConsoleUnconfigured

function siteUrl(): string | null {
  return process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || null
}

export function isSearchConsoleConfigured(): boolean {
  const hasAuth =
    Boolean(process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON?.trim()) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())
  return Boolean(siteUrl()) && hasAuth
}

let authClientPromise: Promise<{ getAccessToken(): Promise<{ token?: string | null }> }> | null = null

function getAuthClient() {
  if (!authClientPromise) {
    const rawJson = process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON?.trim()
    let credentials: Record<string, unknown> | undefined
    if (rawJson) {
      try {
        credentials = JSON.parse(rawJson) as Record<string, unknown>
      } catch {
        throw new Error("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON is not valid JSON")
      }
    }
    const auth = new GoogleAuth({ credentials, scopes: [SEARCH_CONSOLE_SCOPE] })
    authClientPromise = auth.getClient()
  }
  return authClientPromise
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Absolute URL for the page filter (Search Console matches on the full URL). */
function absoluteForPath(path: string): string {
  const origin = publicSiteOrigin()
  if (/^https?:\/\//i.test(path)) return path
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`
}

interface SearchAnalyticsRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

async function querySearchAnalytics(
  token: string,
  property: string,
  body: Record<string, unknown>,
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `${API_BASE}/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Search Console data is daily; cache for an hour.
      next: { revalidate: 3600 },
    },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Search Console API ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { rows?: SearchAnalyticsRow[] }
  return json.rows ?? []
}

/**
 * Click/impression/CTR/position + top queries for one page over the trailing window.
 * Returns `{ configured: false }` (never throws for the unconfigured case) so callers render a hint.
 */
export async function getPageSearchPerformance(
  path: string,
  options?: { days?: number },
): Promise<SearchConsoleResult> {
  const property = siteUrl()
  if (!isSearchConsoleConfigured() || !property) {
    return { configured: false, reason: "Search Console is not connected." }
  }

  const days = options?.days ?? 28
  const startDate = isoDaysAgo(days)
  const endDate = isoDaysAgo(1)
  const pageUrl = absoluteForPath(path)
  const filter = {
    dimensionFilterGroups: [
      { filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] },
    ],
  }

  const client = await getAuthClient()
  const { token } = await client.getAccessToken()
  if (!token) return { configured: false, reason: "Could not authenticate with Search Console." }

  const [totals, queries] = await Promise.all([
    querySearchAnalytics(token, property, { startDate, endDate, ...filter, rowLimit: 1 }),
    querySearchAnalytics(token, property, {
      startDate,
      endDate,
      dimensions: ["query"],
      ...filter,
      rowLimit: 5,
    }),
  ])

  const total = totals[0]
  return {
    configured: true,
    clicks: total?.clicks ?? 0,
    impressions: total?.impressions ?? 0,
    ctr: total?.ctr ?? 0,
    position: total?.position ?? 0,
    topQueries: queries.map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? 0,
    })),
    rangeDays: days,
  }
}
