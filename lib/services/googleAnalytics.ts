import { getVercelOidcToken } from "@vercel/oidc"
import { ExternalAccountClient, GoogleAuth } from "google-auth-library"

/**
 * Google Analytics 4 (Data API) integration — site-side traffic for the products you advertise
 * through Merchant Center. Fully optional: every function degrades gracefully and returns an
 * "unconfigured" result when credentials/property are not set, so the Merchant dashboard works
 * with or without it (mirrors lib/services/searchConsole.ts).
 *
 * Merchant Center reports already give you Shopping clicks/impressions per product. GA4 adds the
 * on-site half of the funnel: how those visitors behave once they land on a product page.
 *
 * Auth resolves in this order (matching lib/google-merchant/auth.ts):
 * 1. Workload Identity Federation via Vercel OIDC — shared GCP_* vars below.
 * 2. Inline service-account JSON (GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON).
 * 3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Env:
 * - GA4_PROPERTY_ID                         numeric GA4 property id, e.g. `123456789`
 * - GA4_PRODUCT_PATH_PREFIX                 optional, defaults to `/l/` (Reswell listing detail pages)
 * - WIF: GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID,
 *        GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (the impersonated SA must be added as a GA4
 *        property viewer)
 * - GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON   service-account JSON (GA4 property viewer)
 */

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
const DEFAULT_PRODUCT_PATH_PREFIX = "/l/"
const PARTNER_EMBED_PATH_PREFIX = "/embed/listings/"
const PARTNER_EMBED_CLICK_EVENT = "partner_embed_click"

export interface GoogleAnalyticsTopPage {
  path: string
  title: string | null
  views: number
  sessions: number
  engagementRate: number
}

export interface GoogleAnalyticsChannel {
  channel: string
  sessions: number
  views: number
}

export interface GoogleAnalyticsDaily {
  date: string
  sessions: number
  views: number
}

export interface GoogleAnalyticsTraffic {
  configured: true
  rangeDays: number
  totals: {
    sessions: number
    totalUsers: number
    screenPageViews: number
    engagedSessions: number
    engagementRate: number
    conversions: number
  }
  topPages: GoogleAnalyticsTopPage[]
  channels: GoogleAnalyticsChannel[]
  daily: GoogleAnalyticsDaily[]
}

export interface GoogleAnalyticsUnconfigured {
  configured: false
  reason: string
}

export type GoogleAnalyticsResult = GoogleAnalyticsTraffic | GoogleAnalyticsUnconfigured

export interface GoogleAnalyticsEmbedClickBreakdown {
  linkType: string
  count: number
}

export interface GoogleAnalyticsEmbedStat {
  slug: string
  path: string
  sessions: number
  views: number
  clicks: number
  clickThroughRate: number
}

export interface GoogleAnalyticsComparisonMetric {
  current: number
  prior: number
  changePercent: number | null
}

export interface GoogleAnalyticsDimensionRow {
  label: string
  sessions: number
  views: number
}

export interface GoogleAnalyticsEventRow {
  eventName: string
  count: number
}

export interface GoogleAnalyticsReferrerRow {
  referrer: string
  sessions: number
}

export interface GoogleAnalyticsDashboardComparison {
  sessions: GoogleAnalyticsComparisonMetric
  users: GoogleAnalyticsComparisonMetric
  pageViews: GoogleAnalyticsComparisonMetric
  conversions: GoogleAnalyticsComparisonMetric
  embedSessions: GoogleAnalyticsComparisonMetric
  embedClicks: GoogleAnalyticsComparisonMetric
}

export interface GoogleAnalyticsDashboardData {
  configured: true
  rangeDays: number
  propertyId: string
  productPathPrefix: string
  clientMeasurementConfigured: boolean
  generatedAt: string
  realtime: { activeUsers: number }
  comparison: GoogleAnalyticsDashboardComparison
  site: GoogleAnalyticsTraffic
  productPages: Omit<GoogleAnalyticsTraffic, "configured" | "rangeDays">
  partnerEmbeds: {
    totals: {
      sessions: number
      totalUsers: number
      screenPageViews: number
      clicks: number
      clickThroughRate: number
    }
    daily: GoogleAnalyticsDaily[]
    clickDaily: { date: string; clicks: number }[]
    byEmbed: GoogleAnalyticsEmbedStat[]
    clicksByLinkType: GoogleAnalyticsEmbedClickBreakdown[]
    referrers: GoogleAnalyticsReferrerRow[]
  }
  devices: GoogleAnalyticsDimensionRow[]
  countries: GoogleAnalyticsDimensionRow[]
  topEvents: GoogleAnalyticsEventRow[]
  insights: string[]
}

export type GoogleAnalyticsDashboardResult =
  | GoogleAnalyticsDashboardData
  | GoogleAnalyticsUnconfigured

type AccessTokenClient = {
  getAccessToken(): Promise<{ token?: string | null }>
}

function envValue(key: string): string | null {
  const v = process.env[key]?.trim()
  return v || null
}

function propertyId(): string | null {
  return envValue("GA4_PROPERTY_ID")
}

/** Warn when GA4_PROPERTY_ID is set to a G-* measurement id instead of the numeric property id. */
function ga4PropertyIdMisconfiguration(): string | null {
  const id = propertyId()
  if (!id) return null
  if (/^G-/i.test(id)) {
    return (
      "GA4_PROPERTY_ID is set to a Measurement ID (G-…). Use the numeric Property ID from GA4 Admin → Property settings instead. Keep the G- id in NEXT_PUBLIC_GA4_MEASUREMENT_ID."
    )
  }
  if (!/^\d+$/.test(id)) {
    return "GA4_PROPERTY_ID must be numeric (e.g. 123456789), not a G- measurement ID."
  }
  return null
}

function formatGa4DataApiError(status: number, detail: string): string {
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  const accessHint = serviceAccountEmail
    ? `Add ${serviceAccountEmail} as a Viewer on the GA4 property (Admin → Property access management → + → Add users).`
    : "Grant your Google service account Viewer access on the GA4 property (Admin → Property access management)."

  if (status === 403) {
    return `Google Analytics permission denied for property ${propertyId() ?? "(unknown)"}. ${accessHint}`
  }
  if (status === 404) {
    return `GA4 property ${propertyId() ?? "(unknown)"} was not found. Confirm GA4_PROPERTY_ID matches Admin → Property settings → Property ID (numeric, not G-…).`
  }

  const trimmed = detail.slice(0, 240)
  return trimmed ? `GA4 Data API ${status}: ${trimmed}` : `GA4 Data API ${status}`
}

function productPathPrefix(): string {
  return envValue("GA4_PRODUCT_PATH_PREFIX") || DEFAULT_PRODUCT_PATH_PREFIX
}

function isWorkloadIdentityConfigured(): boolean {
  return Boolean(
    process.env.GCP_PROJECT_NUMBER?.trim() &&
      process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
  )
}

function isEnvEmpty(key: string): boolean {
  return key in process.env && !envValue(key)
}

const GCP_WIF_KEYS = [
  "GCP_PROJECT_NUMBER",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
] as const

/** Env keys still missing for GA4 (empty when fully configured). */
export function getGoogleAnalyticsConfigGap(): string[] {
  const missing: string[] = []

  const propertyMisconfig = ga4PropertyIdMisconfiguration()
  if (propertyMisconfig) {
    missing.push(propertyMisconfig)
  } else if (!propertyId()) {
    missing.push(
      isEnvEmpty("GA4_PROPERTY_ID")
        ? "GA4_PROPERTY_ID (set but empty — use the numeric GA4 property id)"
        : "GA4_PROPERTY_ID",
    )
  }

  const hasAuth =
    isWorkloadIdentityConfigured() ||
    Boolean(envValue("GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON")) ||
    Boolean(envValue("GOOGLE_APPLICATION_CREDENTIALS"))

  if (!hasAuth) {
    const emptyWif = GCP_WIF_KEYS.filter(isEnvEmpty)
    if (emptyWif.length > 0) {
      missing.push(
        `${emptyWif.join(", ")} (empty in .env.local — Vercel encrypts these; use \`vercel dev\` or paste values from the Vercel dashboard)`,
      )
    } else {
      missing.push(
        "GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (WIF) or GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON",
      )
    }
  }

  return missing
}

export function isGoogleAnalyticsConfigured(): boolean {
  return getGoogleAnalyticsConfigGap().length === 0
}

export function getGoogleAnalyticsSetupHint(): string {
  const gap = getGoogleAnalyticsConfigGap()
  if (gap.length === 0) return ""
  return `${gap.join("; ")}. Add the service account as a GA4 property viewer, then restart the dev server.`
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
    scopes: [ANALYTICS_SCOPE],
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

  const rawJson = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON?.trim()
  let credentials: Record<string, unknown> | undefined
  if (rawJson) {
    try {
      credentials = JSON.parse(rawJson) as Record<string, unknown>
    } catch {
      throw new Error("GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON is not valid JSON")
    }
  }

  const auth = new GoogleAuth({ credentials, scopes: [ANALYTICS_SCOPE] })
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

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface GoogleAnalyticsReportRequest {
  dateRanges: { startDate: string; endDate: string }[]
  dimensions?: { name: string }[]
  metrics: { name: string }[]
  dimensionFilter?: unknown
  metricFilter?: unknown
  orderBys?: unknown[]
  limit?: number
}

export interface GoogleAnalyticsReportRow {
  dimensionValues: string[]
  metricValues: number[]
}

type GaRunReportRequest = GoogleAnalyticsReportRequest

interface GaRow {
  dimensionValues?: { value?: string }[]
  metricValues?: { value?: string }[]
}

interface GaRunReportResponse {
  rows?: GaRow[]
}

async function runReport(
  token: string,
  property: string,
  body: GaRunReportRequest,
): Promise<GaRow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // GA4 data is roughly daily; cache for an hour.
      next: { revalidate: 3600 },
    },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(formatGa4DataApiError(res.status, detail))
  }
  const json = (await res.json()) as GaRunReportResponse
  return json.rows ?? []
}

function pathPrefixFilter(prefix: string): unknown {
  return {
    filter: {
      fieldName: "pagePath",
      stringFilter: { matchType: "BEGINS_WITH", value: prefix },
    },
  }
}

function eventNameFilter(eventName: string): unknown {
  return {
    filter: {
      fieldName: "eventName",
      stringFilter: { matchType: "EXACT", value: eventName },
    },
  }
}

function andFilter(expressions: unknown[]): unknown {
  return { andGroup: { expressions } }
}

function parseGaDate(raw: string): string {
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
}

function embedSlugFromPath(path: string): string | null {
  const match = /^\/embed\/listings\/([^/?#]+)/.exec(path)
  return match?.[1] ?? null
}

function isClientGa4MeasurementConfigured(): boolean {
  const raw = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
  return Boolean(raw && /^G-[A-Z0-9]+$/.test(raw))
}

async function runReportSafe(
  token: string,
  property: string,
  body: GaRunReportRequest,
): Promise<GaRow[]> {
  try {
    return await runReport(token, property, body)
  } catch {
    return []
  }
}

async function queryGoogleAnalyticsTraffic(
  token: string,
  property: string,
  options: {
    startDate: string
    endDate: string
    pathPrefix?: string | null
    topPagesLimit?: number
  },
): Promise<Omit<GoogleAnalyticsTraffic, "configured" | "rangeDays">> {
  const dimensionFilter = options.pathPrefix ? pathPrefixFilter(options.pathPrefix) : undefined
  const metricNames = [
    "sessions",
    "totalUsers",
    "screenPageViews",
    "engagedSessions",
    "engagementRate",
    "conversions",
  ]

  const [totalsRows, pageRows, channelRows, dailyRows] = await Promise.all([
    runReport(token, property, {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      metrics: metricNames.map((name) => ({ name })),
      ...(dimensionFilter ? { dimensionFilter } : {}),
    }),
    runReport(token, property, {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "engagementRate" }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: options.topPagesLimit ?? 25,
    }),
    runReport(token, property, {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 12,
    }),
    runReport(token, property, {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
  ])

  const totalsValues = totalsRows[0]?.metricValues ?? []
  const totals = {
    sessions: toNumber(totalsValues[0]?.value),
    totalUsers: toNumber(totalsValues[1]?.value),
    screenPageViews: toNumber(totalsValues[2]?.value),
    engagedSessions: toNumber(totalsValues[3]?.value),
    engagementRate: toNumber(totalsValues[4]?.value),
    conversions: toNumber(totalsValues[5]?.value),
  }

  const topPages: GoogleAnalyticsTopPage[] = pageRows.map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "",
    title: row.dimensionValues?.[1]?.value || null,
    views: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    engagementRate: toNumber(row.metricValues?.[2]?.value),
  }))

  const channels: GoogleAnalyticsChannel[] = channelRows.map((row) => ({
    channel: row.dimensionValues?.[0]?.value || "(unknown)",
    sessions: toNumber(row.metricValues?.[0]?.value),
    views: toNumber(row.metricValues?.[1]?.value),
  }))

  const daily: GoogleAnalyticsDaily[] = dailyRows
    .map((row) => ({
      date: parseGaDate(row.dimensionValues?.[0]?.value ?? ""),
      sessions: toNumber(row.metricValues?.[0]?.value),
      views: toNumber(row.metricValues?.[1]?.value),
    }))
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  return { totals, topPages, channels, daily }
}

async function queryPartnerEmbedClicks(
  token: string,
  property: string,
  startDate: string,
  endDate: string,
): Promise<{
  totalClicks: number
  clickDaily: { date: string; clicks: number }[]
  clicksByPath: Map<string, number>
  clicksByLinkType: GoogleAnalyticsEmbedClickBreakdown[]
}> {
  const eventFilter = eventNameFilter(PARTNER_EMBED_CLICK_EVENT)
  const embedEventFilter = andFilter([
    pathPrefixFilter(PARTNER_EMBED_PATH_PREFIX),
    eventNameFilter(PARTNER_EMBED_CLICK_EVENT),
  ])

  const [totalRows, dailyRows, pathRows, linkTypeRows] = await Promise.all([
    runReport(token, property, {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: eventFilter,
    }),
    runReport(token, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: eventFilter,
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runReport(token, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: embedEventFilter,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 50,
    }),
    runReportSafe(token, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "customEvent:link_type" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: eventFilter,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 10,
    }),
  ])

  const clicksByPath = new Map<string, number>()
  for (const row of pathRows) {
    const path = row.dimensionValues?.[0]?.value ?? ""
    if (!path) continue
    clicksByPath.set(path, toNumber(row.metricValues?.[0]?.value))
  }

  return {
    totalClicks: toNumber(totalRows[0]?.metricValues?.[0]?.value),
    clickDaily: dailyRows
      .map((row) => ({
        date: parseGaDate(row.dimensionValues?.[0]?.value ?? ""),
        clicks: toNumber(row.metricValues?.[0]?.value),
      }))
      .filter((row) => row.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    clicksByPath,
    clicksByLinkType: linkTypeRows
      .map((row) => ({
        linkType: row.dimensionValues?.[0]?.value || "(unknown)",
        count: toNumber(row.metricValues?.[0]?.value),
      }))
      .filter((row) => row.count > 0),
  }
}

function clickThroughRate(clicks: number, sessions: number): number {
  if (sessions <= 0) return 0
  return clicks / sessions
}

function comparisonMetric(current: number, prior: number): GoogleAnalyticsComparisonMetric {
  const changePercent =
    prior > 0 ? ((current - prior) / prior) * 100 : current > 0 ? null : 0
  return { current, prior, changePercent }
}

function periodBounds(days: number): {
  current: { startDate: string; endDate: string }
  prior: { startDate: string; endDate: string }
} {
  return {
    current: { startDate: isoDaysAgo(days), endDate: isoDaysAgo(1) },
    prior: { startDate: isoDaysAgo(days * 2), endDate: isoDaysAgo(days + 1) },
  }
}

async function queryTotalsSnapshot(
  token: string,
  property: string,
  startDate: string,
  endDate: string,
  pathPrefix?: string | null,
): Promise<{
  sessions: number
  totalUsers: number
  screenPageViews: number
  conversions: number
}> {
  const dimensionFilter = pathPrefix ? pathPrefixFilter(pathPrefix) : undefined
  const rows = await runReport(token, property, {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
      { name: "conversions" },
    ],
    ...(dimensionFilter ? { dimensionFilter } : {}),
  })
  const values = rows[0]?.metricValues ?? []
  return {
    sessions: toNumber(values[0]?.value),
    totalUsers: toNumber(values[1]?.value),
    screenPageViews: toNumber(values[2]?.value),
    conversions: toNumber(values[3]?.value),
  }
}

async function queryEventCount(
  token: string,
  property: string,
  startDate: string,
  endDate: string,
  eventName: string,
): Promise<number> {
  const rows = await runReport(token, property, {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: eventNameFilter(eventName),
  })
  return toNumber(rows[0]?.metricValues?.[0]?.value)
}

async function queryDimensionBreakdown(
  token: string,
  property: string,
  options: {
    startDate: string
    endDate: string
    dimension: string
    pathPrefix?: string | null
    limit?: number
  },
): Promise<GoogleAnalyticsDimensionRow[]> {
  const dimensionFilter = options.pathPrefix ? pathPrefixFilter(options.pathPrefix) : undefined
  const rows = await runReport(token, property, {
    dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
    dimensions: [{ name: options.dimension }],
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
    ...(dimensionFilter ? { dimensionFilter } : {}),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: options.limit ?? 12,
  })

  return rows
    .map((row) => ({
      label: row.dimensionValues?.[0]?.value?.trim() || "(not set)",
      sessions: toNumber(row.metricValues?.[0]?.value),
      views: toNumber(row.metricValues?.[1]?.value),
    }))
    .filter((row) => row.sessions > 0 || row.views > 0)
}

async function queryTopEvents(
  token: string,
  property: string,
  startDate: string,
  endDate: string,
): Promise<GoogleAnalyticsEventRow[]> {
  const rows = await runReport(token, property, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 20,
  })

  return rows
    .map((row) => ({
      eventName: row.dimensionValues?.[0]?.value ?? "(unknown)",
      count: toNumber(row.metricValues?.[0]?.value),
    }))
    .filter((row) => row.count > 0)
}

async function queryEmbedReferrers(
  token: string,
  property: string,
  startDate: string,
  endDate: string,
): Promise<GoogleAnalyticsReferrerRow[]> {
  const rows = await runReportSafe(token, property, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pageReferrer" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: pathPrefixFilter(PARTNER_EMBED_PATH_PREFIX),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 15,
  })

  return rows
    .map((row) => ({
      referrer: row.dimensionValues?.[0]?.value?.trim() || "(direct)",
      sessions: toNumber(row.metricValues?.[0]?.value),
    }))
    .filter((row) => row.sessions > 0)
}

async function queryRealtimeActiveUsers(token: string, property: string): Promise<number> {
  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runRealtimeReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: [{ name: "activeUsers" }] }),
        cache: "no-store",
      },
    )
    if (!res.ok) return 0
    const json = (await res.json()) as GaRunReportResponse
    return toNumber(json.rows?.[0]?.metricValues?.[0]?.value)
  } catch {
    return 0
  }
}

function buildAnalyticsInsights(input: {
  comparison: GoogleAnalyticsDashboardComparison
  siteEngagementRate: number
  embedClickThroughRate: number
  topChannel: string | null
  topEmbed: GoogleAnalyticsEmbedStat | null
  topEvent: GoogleAnalyticsEventRow | null
}): string[] {
  const insights: string[] = []

  const sessionDelta = input.comparison.sessions.changePercent
  if (sessionDelta != null && Math.abs(sessionDelta) >= 8) {
    insights.push(
      sessionDelta > 0
        ? `Site sessions are up ${sessionDelta.toFixed(0)}% vs the prior ${input.comparison.sessions.prior > 0 ? "period" : "window"}.`
        : `Site sessions are down ${Math.abs(sessionDelta).toFixed(0)}% vs the prior period.`,
    )
  }

  const embedClickDelta = input.comparison.embedClicks.changePercent
  if (embedClickDelta != null && Math.abs(embedClickDelta) >= 10) {
    insights.push(
      embedClickDelta > 0
        ? `Partner embed outbound clicks rose ${embedClickDelta.toFixed(0)}% period-over-period.`
        : `Partner embed outbound clicks fell ${Math.abs(embedClickDelta).toFixed(0)}% period-over-period.`,
    )
  }

  if (input.embedClickThroughRate >= 0.08) {
    insights.push(
      `Embed click-through rate is ${(input.embedClickThroughRate * 100).toFixed(1)}% — visitors are engaging with listings and CTAs.`,
    )
  } else if (input.comparison.embedSessions.current > 20 && input.embedClickThroughRate < 0.02) {
    insights.push(
      "Embed sessions are landing but click-through is low — review creative, listing mix, or CTA placement.",
    )
  }

  if (input.siteEngagementRate >= 0.55) {
    insights.push(`Engagement rate is healthy at ${(input.siteEngagementRate * 100).toFixed(0)}% across the site.`)
  }

  if (input.topChannel) {
    insights.push(`Top acquisition channel: ${input.topChannel}.`)
  }

  if (input.topEmbed && input.topEmbed.sessions > 0) {
    insights.push(
      `Leading partner embed: ${input.topEmbed.slug} (${input.topEmbed.sessions.toLocaleString("en-US")} sessions, ${input.topEmbed.clicks.toLocaleString("en-US")} clicks).`,
    )
  }

  if (input.topEvent && input.topEvent.eventName === PARTNER_EMBED_CLICK_EVENT) {
    insights.push(
      `Custom embed click tracking is active — ${input.topEvent.count.toLocaleString("en-US")} partner_embed_click events recorded.`,
    )
  }

  return insights.slice(0, 6)
}

function withEmbedClickThroughRates(rows: GoogleAnalyticsEmbedStat[]): GoogleAnalyticsEmbedStat[] {
  return rows.map((row) => ({
    ...row,
    clickThroughRate: clickThroughRate(row.clicks, row.sessions),
  }))
}

function mergeEmbedStats(
  embedTraffic: Omit<GoogleAnalyticsTraffic, "configured" | "rangeDays">,
  clicksByPath: Map<string, number>,
): GoogleAnalyticsEmbedStat[] {
  const bySlug = new Map<string, GoogleAnalyticsEmbedStat>()

  for (const page of embedTraffic.topPages) {
    const slug = embedSlugFromPath(page.path)
    if (!slug) continue
    const existing = bySlug.get(slug)
    if (existing) {
      existing.sessions += page.sessions
      existing.views += page.views
      continue
    }
    bySlug.set(slug, {
      slug,
      path: page.path,
      sessions: page.sessions,
      views: page.views,
      clicks: clicksByPath.get(page.path) ?? 0,
      clickThroughRate: 0,
    })
  }

  for (const [path, clicks] of clicksByPath) {
    const slug = embedSlugFromPath(path)
    if (!slug) continue
    const existing = bySlug.get(slug)
    if (existing) {
      existing.clicks = Math.max(existing.clicks, clicks)
      continue
    }
    bySlug.set(slug, { slug, path, sessions: 0, views: 0, clicks, clickThroughRate: 0 })
  }

  return withEmbedClickThroughRates(
    [...bySlug.values()].sort((a, b) => b.sessions - a.sessions || b.clicks - a.clicks),
  )
}

export function googleAnalyticsDateWindow(days: number): { startDate: string; endDate: string } {
  return { startDate: isoDaysAgo(days), endDate: isoDaysAgo(1) }
}

/**
 * Low-level GA4 Data API report. Returns `{ ok: false }` when credentials/property
 * are missing or the API rejects the request — never throws for those cases.
 */
export async function runGoogleAnalyticsReport(
  body: GoogleAnalyticsReportRequest,
): Promise<
  | { ok: false; reason: string }
  | { ok: true; propertyId: string; rows: GoogleAnalyticsReportRow[] }
> {
  try {
    const access = await loadGoogleAnalyticsAccessToken()
    if (!access.ok) return { ok: false, reason: access.reason }
    const rows = await runReport(access.token, access.property, body)
    return {
      ok: true,
      propertyId: access.property,
      rows: rows.map((row) => ({
        dimensionValues: (row.dimensionValues ?? []).map((d) => d.value ?? ""),
        metricValues: (row.metricValues ?? []).map((m) => toNumber(m.value)),
      })),
    }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Could not load Google Analytics data.",
    }
  }
}

async function loadGoogleAnalyticsAccessToken(): Promise<
  { ok: true; token: string; property: string } | { ok: false; reason: string }
> {
  const property = propertyId()
  if (!isGoogleAnalyticsConfigured() || !property) {
    return {
      ok: false,
      reason: getGoogleAnalyticsSetupHint() || "Google Analytics is not connected.",
    }
  }

  const client = await getAuthClient()
  const { token } = await client.getAccessToken()
  if (!token) {
    return { ok: false, reason: "Could not authenticate with Google Analytics." }
  }

  return { ok: true, token, property }
}

/**
 * GA4 traffic for product detail pages over the trailing window. Returns `{ configured: false }`
 * (never throws for the unconfigured case) so callers render a setup hint.
 */
export async function getGoogleAnalyticsMerchantTraffic(options?: {
  days?: number
}): Promise<GoogleAnalyticsResult> {
  const days = options?.days ?? 28
  const startDate = isoDaysAgo(days)
  const endDate = isoDaysAgo(1)

  try {
    const access = await loadGoogleAnalyticsAccessToken()
    if (!access.ok) {
      return { configured: false, reason: access.reason }
    }

    const snapshot = await queryGoogleAnalyticsTraffic(access.token, access.property, {
      startDate,
      endDate,
      pathPrefix: productPathPrefix(),
    })

    return { configured: true, rangeDays: days, ...snapshot }
  } catch (e) {
    return {
      configured: false,
      reason: e instanceof Error ? e.message : "Could not load Google Analytics data.",
    }
  }
}

/**
 * Site-wide GA4 traffic plus partner embed views and click events for the admin dashboard.
 */
export async function getGoogleAnalyticsDashboardData(options?: {
  days?: number
}): Promise<GoogleAnalyticsDashboardResult> {
  const days = options?.days ?? 28
  const { current, prior } = periodBounds(days)

  try {
    const access = await loadGoogleAnalyticsAccessToken()
    if (!access.ok) {
      return { configured: false, reason: access.reason }
    }

    const [
      site,
      embedTraffic,
      embedClicks,
      productPages,
      currentSiteTotals,
      priorSiteTotals,
      currentEmbedTotals,
      priorEmbedTotals,
      priorEmbedClicks,
      devices,
      countries,
      topEvents,
      embedReferrers,
      activeUsers,
    ] = await Promise.all([
      queryGoogleAnalyticsTraffic(access.token, access.property, {
        startDate: current.startDate,
        endDate: current.endDate,
        topPagesLimit: 25,
      }),
      queryGoogleAnalyticsTraffic(access.token, access.property, {
        startDate: current.startDate,
        endDate: current.endDate,
        pathPrefix: PARTNER_EMBED_PATH_PREFIX,
        topPagesLimit: 50,
      }),
      queryPartnerEmbedClicks(access.token, access.property, current.startDate, current.endDate),
      queryGoogleAnalyticsTraffic(access.token, access.property, {
        startDate: current.startDate,
        endDate: current.endDate,
        pathPrefix: productPathPrefix(),
        topPagesLimit: 15,
      }),
      queryTotalsSnapshot(access.token, access.property, current.startDate, current.endDate),
      queryTotalsSnapshot(access.token, access.property, prior.startDate, prior.endDate),
      queryTotalsSnapshot(
        access.token,
        access.property,
        current.startDate,
        current.endDate,
        PARTNER_EMBED_PATH_PREFIX,
      ),
      queryTotalsSnapshot(
        access.token,
        access.property,
        prior.startDate,
        prior.endDate,
        PARTNER_EMBED_PATH_PREFIX,
      ),
      queryEventCount(
        access.token,
        access.property,
        prior.startDate,
        prior.endDate,
        PARTNER_EMBED_CLICK_EVENT,
      ),
      queryDimensionBreakdown(access.token, access.property, {
        startDate: current.startDate,
        endDate: current.endDate,
        dimension: "deviceCategory",
        limit: 8,
      }),
      queryDimensionBreakdown(access.token, access.property, {
        startDate: current.startDate,
        endDate: current.endDate,
        dimension: "country",
        limit: 12,
      }),
      queryTopEvents(access.token, access.property, current.startDate, current.endDate),
      queryEmbedReferrers(access.token, access.property, current.startDate, current.endDate),
      queryRealtimeActiveUsers(access.token, access.property),
    ])

    const byEmbed = mergeEmbedStats(embedTraffic, embedClicks.clicksByPath)
    const embedCtr = clickThroughRate(embedClicks.totalClicks, embedTraffic.totals.sessions)

    const comparison: GoogleAnalyticsDashboardComparison = {
      sessions: comparisonMetric(currentSiteTotals.sessions, priorSiteTotals.sessions),
      users: comparisonMetric(currentSiteTotals.totalUsers, priorSiteTotals.totalUsers),
      pageViews: comparisonMetric(currentSiteTotals.screenPageViews, priorSiteTotals.screenPageViews),
      conversions: comparisonMetric(currentSiteTotals.conversions, priorSiteTotals.conversions),
      embedSessions: comparisonMetric(currentEmbedTotals.sessions, priorEmbedTotals.sessions),
      embedClicks: comparisonMetric(embedClicks.totalClicks, priorEmbedClicks),
    }

    const insights = buildAnalyticsInsights({
      comparison,
      siteEngagementRate: site.totals.engagementRate,
      embedClickThroughRate: embedCtr,
      topChannel: site.channels[0]?.channel ?? null,
      topEmbed: byEmbed[0] ?? null,
      topEvent: topEvents[0] ?? null,
    })

    return {
      configured: true,
      rangeDays: days,
      propertyId: access.property,
      productPathPrefix: productPathPrefix(),
      clientMeasurementConfigured: isClientGa4MeasurementConfigured(),
      generatedAt: new Date().toISOString(),
      realtime: { activeUsers },
      comparison,
      site: { configured: true, rangeDays: days, ...site },
      productPages,
      partnerEmbeds: {
        totals: {
          sessions: embedTraffic.totals.sessions,
          totalUsers: embedTraffic.totals.totalUsers,
          screenPageViews: embedTraffic.totals.screenPageViews,
          clicks: embedClicks.totalClicks,
          clickThroughRate: embedCtr,
        },
        daily: embedTraffic.daily,
        clickDaily: embedClicks.clickDaily,
        byEmbed,
        clicksByLinkType: embedClicks.clicksByLinkType,
        referrers: embedReferrers,
      },
      devices,
      countries,
      topEvents,
      insights,
    }
  } catch (e) {
    return {
      configured: false,
      reason: e instanceof Error ? e.message : "Could not load Google Analytics data.",
    }
  }
}
