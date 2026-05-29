import { getVercelOidcToken } from "@vercel/oidc"
import { ExternalAccountClient, GoogleAuth } from "google-auth-library"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/**
 * Google Search Console (Search Analytics) integration. Fully optional: every function degrades
 * gracefully and returns an "unconfigured" result when credentials/property are not set, so the
 * admin SEO panel works with or without it.
 *
 * Auth resolves in this order (matching lib/google-merchant/auth.ts):
 * 1. Workload Identity Federation via Vercel OIDC — shared GCP_* vars below.
 * 2. Inline service-account JSON.
 * 3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Env:
 * - GOOGLE_SEARCH_CONSOLE_SITE_URL          property, e.g. `sc-domain:reswell.app` or `https://reswell.app/`
 * - WIF: GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID,
 *        GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (the impersonated SA must have read access to the property)
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

type AccessTokenClient = {
  getAccessToken(): Promise<{ token?: string | null }>
}

function envValue(key: string): string | null {
  const v = process.env[key]?.trim()
  return v || null
}

function siteUrl(): string | null {
  return envValue("GOOGLE_SEARCH_CONSOLE_SITE_URL")
}

function isWorkloadIdentityConfigured(): boolean {
  return Boolean(
    process.env.GCP_PROJECT_NUMBER?.trim() &&
      process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
  )
}

export function isSearchConsoleConfigured(): boolean {
  return getSearchConsoleConfigGap().length === 0
}

const GCP_WIF_KEYS = [
  "GCP_PROJECT_NUMBER",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
] as const

function isEnvEmpty(key: string): boolean {
  return key in process.env && !envValue(key)
}

/** Env keys still missing for Search Console (empty when fully configured). */
export function getSearchConsoleConfigGap(): string[] {
  const missing: string[] = []

  if (!siteUrl()) {
    missing.push(
      isEnvEmpty("GOOGLE_SEARCH_CONSOLE_SITE_URL")
        ? "GOOGLE_SEARCH_CONSOLE_SITE_URL (set but empty — use sc-domain:reswell.app or your URL-prefix property)"
        : "GOOGLE_SEARCH_CONSOLE_SITE_URL",
    )
  }

  const hasAuth =
    isWorkloadIdentityConfigured() ||
    Boolean(envValue("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON")) ||
    Boolean(envValue("GOOGLE_APPLICATION_CREDENTIALS"))

  if (!hasAuth) {
    const emptyWif = GCP_WIF_KEYS.filter(isEnvEmpty)
    if (emptyWif.length > 0) {
      missing.push(
        `${emptyWif.join(", ")} (empty in .env.local — Vercel encrypts these; use \`vercel dev\` or paste values from the Vercel dashboard)`,
      )
    } else {
      missing.push(
        "GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (WIF) or GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON",
      )
    }
  }

  return missing
}

export function getSearchConsoleSetupHint(): string {
  const gap = getSearchConsoleConfigGap()
  if (gap.length === 0) return ""
  return `${gap.join("; ")}. Restart the dev server after updating env.`
}

let authClientPromise: Promise<AccessTokenClient> | null = null

function createWorkloadIdentityClient(): AccessTokenClient {
  const projectNumber = process.env.GCP_PROJECT_NUMBER?.trim()
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim()
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim()

  if (!projectNumber || !serviceAccountEmail || !poolId || !providerId) {
    throw new Error(
      "Workload Identity Federation requires GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, and GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
    )
  }

  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    scopes: [SEARCH_CONSOLE_SCOPE],
    subject_token_supplier: {
      getSubjectToken: async () => getVercelOidcToken(),
    },
  })

  if (!client) {
    throw new Error("Failed to create ExternalAccountClient for Workload Identity Federation")
  }

  return client
}

function createAuthClient(): Promise<AccessTokenClient> {
  if (isWorkloadIdentityConfigured()) {
    return Promise.resolve(createWorkloadIdentityClient())
  }

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
  return auth.getClient()
}

function getAuthClient(): Promise<AccessTokenClient> {
  if (!authClientPromise) {
    authClientPromise = createAuthClient()
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
    const hint = getSearchConsoleSetupHint()
    return {
      configured: false,
      reason: hint || "Search Console is not connected.",
    }
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
