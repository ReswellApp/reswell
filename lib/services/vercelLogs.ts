/**
 * Fetches and classifies Vercel production runtime/request logs for error monitoring.
 * Requires VERCEL_ACCESS_TOKEN; project/team IDs fall back to Vercel system env when unset.
 */

const VERCEL_API = "https://api.vercel.com"

export type VercelLogSeverity = "critical" | "warning"

export type VercelLogIssue = {
  severity: VercelLogSeverity
  category: string
  path: string
  method: string
  statusCode: number | null
  level: string
  message: string
  timestampMs: number
  source: string
  deploymentId: string
  occurrences: number
}

export type VercelLogScanResult = {
  scannedAt: string
  rangeHours: number
  deploymentsScanned: number
  rawLogCount: number
  filteredLogCount: number
  criticalCount: number
  warningCount: number
  issues: VercelLogIssue[]
  skippedReason?: string
}

export type VercelRuntimeLog = {
  level: string
  message: string
  requestPath?: string
  requestMethod?: string
  responseStatusCode?: number
  source?: string
  timestampInMs?: number
  rowId?: string
}

type VercelDeployment = {
  uid: string
  created: number
  state?: string
  target?: string | null
}

export type VercelLogsConfig = {
  accessToken: string
  projectId: string
  teamId?: string
}

const BOT_NOISE_PATH =
  /\/(\.env|\.git|wp-admin|wp-login|xmlrpc\.php|phpmyadmin|\.well-known\/apple-app-site-association$)|\.(php|asp|aspx|cgi)$/i

const USER_FACING_PREFIXES = [
  "/api/",
  "/checkout",
  "/auth",
  "/sell",
  "/orders",
  "/messages",
  "/profile",
  "/search",
  "/wallet",
  "/payouts",
  "/cart",
  "/favorites",
  "/listings",
  "/boards",
  "/fins",
  "/shop",
  "/contact",
  "/account",
  "/settings",
  "/stripe",
  "/paypal",
]

function teamQuery(teamId?: string): string {
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""
}

export function resolveVercelLogsConfig(): VercelLogsConfig | { error: string } {
  const accessToken =
    process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined

  if (!accessToken) {
    return {
      error:
        "VERCEL_ACCESS_TOKEN is not set. Create a PAT at vercel.com/account/tokens and add it to Vercel env (Production).",
    }
  }

  const resolvedProjectId =
    process.env.VERCEL_LOGS_PROJECT_ID?.trim() ||
    process.env.VERCEL_PROJECT_ID?.trim()

  if (!resolvedProjectId) {
    return {
      error:
        "VERCEL_PROJECT_ID is not set. Copy it from Vercel → Project → Settings → General.",
    }
  }

  return { accessToken, projectId: resolvedProjectId, teamId }
}

function isCronRoute(path: string): boolean {
  return path.startsWith("/api/cron/") || path.startsWith("/api/listings/purge-archived")
}

function isStaticNoise(path: string): boolean {
  if (!path || path === "/") return false
  if (path.startsWith("/_next/")) return true
  if (path.startsWith("/media/")) return false
  if (BOT_NOISE_PATH.test(path)) return true
  return false
}

function isUserFacingPath(path: string): boolean {
  if (!path) return false
  if (isStaticNoise(path) || isCronRoute(path)) return false
  if (USER_FACING_PREFIXES.some((p) => path === p || path.startsWith(p))) return true
  // App routes: single-segment paths like /sell, /search, or multi-segment without file extensions.
  if (/^\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/i.test(path)) return true
  return false
}

function shouldSkipLog(log: VercelRuntimeLog): boolean {
  const path = log.requestPath ?? ""
  if (isStaticNoise(path)) return true
  if (isCronRoute(path)) return true
  return false
}

export function classifyRuntimeLog(
  log: VercelRuntimeLog,
  deploymentId: string,
): VercelLogIssue | null {
  if (shouldSkipLog(log)) return null

  const path = log.requestPath ?? "(no path)"
  const method = log.requestMethod ?? "—"
  const status = log.responseStatusCode ?? null
  const level = (log.level ?? "info").toLowerCase()
  const message = (log.message ?? "").slice(0, 500)
  const source = log.source ?? "unknown"
  const timestampMs = log.timestampInMs ?? Date.now()

  if (level === "error" || level === "fatal") {
    return {
      severity: "critical",
      category: "runtime",
      path,
      method,
      statusCode: status,
      level,
      message: message || `Runtime ${level}`,
      timestampMs,
      source,
      deploymentId,
      occurrences: 1,
    }
  }

  if (typeof status === "number" && status >= 500) {
    return {
      severity: "critical",
      category: "http_5xx",
      path,
      method,
      statusCode: status,
      level,
      message: message || `HTTP ${status}`,
      timestampMs,
      source,
      deploymentId,
      occurrences: 1,
    }
  }

  if (level === "warning") {
    return {
      severity: "warning",
      category: "runtime_warning",
      path,
      method,
      statusCode: status,
      level,
      message: message || "Runtime warning",
      timestampMs,
      source,
      deploymentId,
      occurrences: 1,
    }
  }

  if (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    isUserFacingPath(path)
  ) {
    // 401/403 on protected routes are common; still surface as warning for visibility.
    return {
      severity: "warning",
      category: status === 404 ? "http_404_user" : "http_4xx_user",
      path,
      method,
      statusCode: status,
      level,
      message: message || `HTTP ${status}`,
      timestampMs,
      source,
      deploymentId,
      occurrences: 1,
    }
  }

  return null
}

function issueKey(issue: VercelLogIssue): string {
  return [
    issue.severity,
    issue.category,
    issue.path,
    issue.method,
    issue.statusCode ?? "",
    issue.message.slice(0, 120),
  ].join("|")
}

export function aggregateIssues(issues: VercelLogIssue[], maxIssues = 25): VercelLogIssue[] {
  const map = new Map<string, VercelLogIssue>()
  for (const issue of issues) {
    const key = issueKey(issue)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...issue })
      continue
    }
    existing.occurrences += 1
    if (issue.timestampMs > existing.timestampMs) {
      existing.timestampMs = issue.timestampMs
      existing.deploymentId = issue.deploymentId
    }
  }

  const severityRank: Record<VercelLogSeverity, number> = { critical: 0, warning: 1 }
  return Array.from(map.values())
    .sort((a, b) => {
      const s = severityRank[a.severity] - severityRank[b.severity]
      if (s !== 0) return s
      return b.occurrences - a.occurrences || b.timestampMs - a.timestampMs
    })
    .slice(0, maxIssues)
}

async function vercelFetch(
  config: VercelLogsConfig,
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 30_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${VERCEL_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function listProductionDeployments(
  config: VercelLogsConfig,
  sinceMs: number,
  limit = 12,
): Promise<VercelDeployment[]> {
  const res = await vercelFetch(
    config,
    `/v6/deployments?projectId=${encodeURIComponent(config.projectId)}&target=production&state=READY&limit=${limit}${teamQuery(config.teamId)}`,
    { timeoutMs: 20_000 },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Vercel deployments list failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as { deployments?: VercelDeployment[] }
  const deployments = data.deployments ?? []
  return deployments.filter((d) => d.created >= sinceMs)
}

async function fetchDeploymentRuntimeLogs(
  config: VercelLogsConfig,
  deploymentId: string,
  sinceMs: number,
  untilMs: number,
): Promise<VercelRuntimeLog[]> {
  const url =
    `/v1/projects/${encodeURIComponent(config.projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs?since=${sinceMs}&until=${untilMs}&limit=500${teamQuery(config.teamId)}`

  const res = await vercelFetch(config, url, {
    timeoutMs: 45_000,
    headers: { Accept: "application/stream+json, application/json" },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.warn(
      `[vercelLogs] runtime-logs ${deploymentId} HTTP ${res.status}: ${text.slice(0, 200)}`,
    )
    return []
  }

  const text = await res.text()
  const logs: VercelRuntimeLog[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("[")) continue
    try {
      const parsed = JSON.parse(trimmed) as VercelRuntimeLog
      if (parsed.timestampInMs && parsed.timestampInMs < sinceMs) continue
      if (parsed.timestampInMs && parsed.timestampInMs > untilMs) continue
      logs.push(parsed)
    } catch {
      // stream may include non-JSON delimiters
    }
  }
  return logs
}

/**
 * Scans production Vercel logs for the last `rangeHours` and returns classified issues.
 */
export async function scanVercelLogs(rangeHours = 24): Promise<VercelLogScanResult> {
  const resolved = resolveVercelLogsConfig()
  if ("error" in resolved) {
    return {
      scannedAt: new Date().toISOString(),
      rangeHours,
      deploymentsScanned: 0,
      rawLogCount: 0,
      filteredLogCount: 0,
      criticalCount: 0,
      warningCount: 0,
      issues: [],
      skippedReason: resolved.error,
    }
  }

  const untilMs = Date.now()
  const sinceMs = untilMs - rangeHours * 60 * 60 * 1000

  let deployments: VercelDeployment[] = []
  try {
    deployments = await listProductionDeployments(resolved, sinceMs)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      scannedAt: new Date().toISOString(),
      rangeHours,
      deploymentsScanned: 0,
      rawLogCount: 0,
      filteredLogCount: 0,
      criticalCount: 0,
      warningCount: 0,
      issues: [],
      skippedReason: msg,
    }
  }

  if (deployments.length === 0) {
    deployments = await listProductionDeployments(resolved, sinceMs - 7 * 24 * 60 * 60 * 1000, 3)
  }

  const allIssues: VercelLogIssue[] = []
  let rawLogCount = 0

  for (const deployment of deployments.slice(0, 8)) {
    let logs: VercelRuntimeLog[] = []
    try {
      logs = await fetchDeploymentRuntimeLogs(
        resolved,
        deployment.uid,
        sinceMs,
        untilMs,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[vercelLogs] skip deployment ${deployment.uid}: ${msg}`)
      continue
    }
    rawLogCount += logs.length
    for (const log of logs) {
      const issue = classifyRuntimeLog(log, deployment.uid)
      if (issue) allIssues.push(issue)
    }
  }

  const issues = aggregateIssues(allIssues)
  const criticalCount = issues.filter((i) => i.severity === "critical").length
  const warningCount = issues.filter((i) => i.severity === "warning").length

  return {
    scannedAt: new Date().toISOString(),
    rangeHours,
    deploymentsScanned: deployments.length,
    rawLogCount,
    filteredLogCount: allIssues.length,
    criticalCount,
    warningCount,
    issues,
  }
}
