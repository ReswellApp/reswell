const DEFAULT_SCAN_HOURS = 24
const MAX_LOG_PAGES = 10

let cachedProjectContext = null

function vercelAccessToken() {
  return (
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    null
  )
}

function vercelProjectId() {
  return (
    process.env.VERCEL_PROJECT_ID?.trim() ||
    process.env.VERCEL_PROJECT?.trim() ||
    null
  )
}

function vercelTeamId() {
  return (
    process.env.VERCEL_TEAM_ID?.trim() ||
    process.env.VERCEL_ORG_ID?.trim() ||
    null
  )
}

async function resolveProjectContext() {
  if (cachedProjectContext) return cachedProjectContext

  const token = vercelAccessToken()
  if (!token) {
    return {
      error:
        "VERCEL_ACCESS_TOKEN is not set — add your PAT to Cursor automation secrets or .env.production.local",
    }
  }

  const projectId = vercelProjectId()
  const teamId = vercelTeamId()
  if (projectId && teamId) {
    cachedProjectContext = { projectId, teamId }
    return cachedProjectContext
  }

  const res = await fetch("https://api.vercel.com/v9/projects?limit=50", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return {
      error: `Vercel projects API failed (${res.status}): ${text.slice(0, 200)}`,
    }
  }

  const data = await res.json()
  const projects = data.projects ?? []
  if (projects.length === 0) {
    return { error: "No Vercel projects found for this token." }
  }

  const preferred =
    projects.find((p) => p.name === "reswell") ??
    projects.find((p) => p.name?.includes("reswell")) ??
    projects[0]

  const resolvedProjectId = projectId ?? preferred.id
  const resolvedTeamId = teamId ?? preferred.accountId

  if (!resolvedProjectId || !resolvedTeamId) {
    return {
      error:
        "Could not resolve VERCEL_PROJECT_ID / VERCEL_TEAM_ID — set them in Vercel → Project → Settings → General",
    }
  }

  cachedProjectContext = {
    projectId: resolvedProjectId,
    teamId: resolvedTeamId,
  }
  return cachedProjectContext
}

function parseSinceMs(sinceHours) {
  return Date.now() - sinceHours * 60 * 60 * 1000
}

function mapApiRow(row) {
  const requestLogs = (row.logs ?? []).map((log) => ({
    level: log.level ?? "info",
    message: log.message ?? "",
  }))

  const severityOrder = { info: 0, warning: 1, error: 2, fatal: 3 }

  const displayLog = requestLogs.reduce(
    (selected, current) =>
      (severityOrder[current.level] ?? -1) > (severityOrder[selected.level] ?? -1)
        ? current
        : selected,
    requestLogs[0] ?? { level: "info", message: "" },
  )

  const firstEvent = row.events?.[0]
  const source = firstEvent?.source ?? "static"

  return {
    id: row.requestId ?? "",
    timestamp: row.timestamp ? Date.parse(row.timestamp) : Date.now(),
    deploymentId: row.deploymentId ?? "",
    level: displayLog.level || "info",
    message: displayLog.message,
    source,
    domain: row.domain ?? "",
    requestMethod: row.requestMethod ?? "",
    requestPath: row.requestPath ?? "",
    responseStatusCode: row.statusCode ?? 0,
    environment: row.environment || "production",
    logs: requestLogs,
  }
}

async function fetchVercelRequestLogsPage(input) {
  const query = new URLSearchParams()
  query.set("projectId", input.projectId)
  query.set("ownerId", input.teamId)
  query.set("page", String(input.page))
  query.set("startDate", String(input.sinceMs))
  query.set("endDate", String(input.untilMs))
  query.set("environment", input.environment)

  const url = `https://vercel.com/api/logs/request-logs?${query.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `Vercel request-logs API failed (${res.status}): ${text.slice(0, 300)}`,
    )
  }

  const data = await res.json()
  const logs = (data.rows ?? []).map((row) => mapApiRow(row))
  return { logs, hasMore: data.hasMoreRows ?? false }
}

async function fetchRecentVercelRequestLogs(input = {}) {
  const token = vercelAccessToken()
  if (!token) {
    throw new Error(
      "VERCEL_ACCESS_TOKEN is not set — create a token at https://vercel.com/account/tokens",
    )
  }

  const context = await resolveProjectContext()
  if ("error" in context) throw new Error(context.error)

  const sinceHours = input.sinceHours ?? DEFAULT_SCAN_HOURS
  const environment = input.environment ?? "production"
  const maxPages = input.maxPages ?? MAX_LOG_PAGES
  const sinceMs = parseSinceMs(sinceHours)
  const untilMs = Date.now()

  const allLogs = []

  for (let page = 0; page < maxPages; page += 1) {
    const { logs, hasMore } = await fetchVercelRequestLogsPage({
      projectId: context.projectId,
      teamId: context.teamId,
      token,
      sinceMs,
      untilMs,
      environment,
      page,
    })

    allLogs.push(...logs)
    if (!hasMore || logs.length === 0) break
  }

  return allLogs
}

function isCronOrInternalPath(path) {
  return (
    path.startsWith("/api/cron/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/media/")
  )
}

function isLikelyBotNoise(path, statusCode) {
  if (statusCode !== 404) return false
  return (
    path.endsWith(".php") ||
    path.endsWith(".env") ||
    path.includes("wp-admin") ||
    path.includes("wp-login") ||
    path.includes(".git")
  )
}

function worstRuntimeLevel(logs) {
  const order = { info: 0, warning: 1, error: 2, fatal: 3 }
  let worst = "info"
  for (const log of logs) {
    if ((order[log.level] ?? -1) > order[worst]) worst = log.level
  }
  return worst
}

function runtimeErrorMessage(entry) {
  const errorLines = entry.logs
    .filter((l) => l.level === "error" || l.level === "fatal" || l.level === "warning")
    .map((l) => l.message.trim())
    .filter(Boolean)

  if (errorLines.length > 0) return errorLines.join(" | ").slice(0, 500)
  return entry.message.trim().slice(0, 500)
}

function classifyLogEntry(entry) {
  const path = entry.requestPath || "/"
  const status = entry.responseStatusCode
  const runtimeLevel = worstRuntimeLevel(entry.logs)
  const message = runtimeErrorMessage(entry)

  if (isCronOrInternalPath(path)) return null
  if (isLikelyBotNoise(path, status)) return null

  if (status >= 500) {
    return {
      severity: "critical",
      category: "server_error",
      requestMethod: entry.requestMethod,
      requestPath: path,
      responseStatusCode: status,
      level: runtimeLevel === "info" ? "error" : runtimeLevel,
      message: message || `HTTP ${status}`,
      source: entry.source,
      environment: entry.environment,
      occurrenceCount: 1,
      firstSeenAt: new Date(entry.timestamp).toISOString(),
      lastSeenAt: new Date(entry.timestamp).toISOString(),
      sampleRequestIds: entry.id ? [entry.id] : [],
    }
  }

  if (runtimeLevel === "fatal" || runtimeLevel === "error") {
    return {
      severity: "critical",
      category: "runtime_error",
      requestMethod: entry.requestMethod,
      requestPath: path,
      responseStatusCode: status,
      level: runtimeLevel,
      message: message || `${runtimeLevel} in ${entry.source}`,
      source: entry.source,
      environment: entry.environment,
      occurrenceCount: 1,
      firstSeenAt: new Date(entry.timestamp).toISOString(),
      lastSeenAt: new Date(entry.timestamp).toISOString(),
      sampleRequestIds: entry.id ? [entry.id] : [],
    }
  }

  const userFacing4xx =
    status === 400 ||
    status === 403 ||
    status === 408 ||
    status === 409 ||
    status === 422 ||
    status === 429

  if (
    userFacing4xx &&
    (path.startsWith("/api/") || path.startsWith("/checkout") || path.startsWith("/auth"))
  ) {
    return {
      severity: "warning",
      category: "client_error",
      requestMethod: entry.requestMethod,
      requestPath: path,
      responseStatusCode: status,
      level: runtimeLevel,
      message: message || `HTTP ${status}`,
      source: entry.source,
      environment: entry.environment,
      occurrenceCount: 1,
      firstSeenAt: new Date(entry.timestamp).toISOString(),
      lastSeenAt: new Date(entry.timestamp).toISOString(),
      sampleRequestIds: entry.id ? [entry.id] : [],
    }
  }

  if (runtimeLevel === "warning") {
    return {
      severity: "warning",
      category: "runtime_warning",
      requestMethod: entry.requestMethod,
      requestPath: path,
      responseStatusCode: status,
      level: runtimeLevel,
      message: message || "Runtime warning",
      source: entry.source,
      environment: entry.environment,
      occurrenceCount: 1,
      firstSeenAt: new Date(entry.timestamp).toISOString(),
      lastSeenAt: new Date(entry.timestamp).toISOString(),
      sampleRequestIds: entry.id ? [entry.id] : [],
    }
  }

  return null
}

function issueGroupKey(issue) {
  return [
    issue.severity,
    issue.category,
    issue.requestMethod,
    issue.requestPath,
    String(issue.responseStatusCode),
    issue.message.slice(0, 120),
  ].join("|")
}

export function analyzeVercelRequestLogs(logs) {
  const grouped = new Map()

  for (const entry of logs) {
    const issue = classifyLogEntry(entry)
    if (!issue) continue

    const key = issueGroupKey(issue)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, issue)
      continue
    }

    existing.occurrenceCount += 1
    if (entry.timestamp < Date.parse(existing.firstSeenAt)) {
      existing.firstSeenAt = new Date(entry.timestamp).toISOString()
    }
    if (entry.timestamp > Date.parse(existing.lastSeenAt)) {
      existing.lastSeenAt = new Date(entry.timestamp).toISOString()
    }
    if (
      entry.id &&
      existing.sampleRequestIds.length < 3 &&
      !existing.sampleRequestIds.includes(entry.id)
    ) {
      existing.sampleRequestIds.push(entry.id)
    }
  }

  const severityRank = { critical: 0, warning: 1 }

  return Array.from(grouped.values()).sort((a, b) => {
    const sev = severityRank[a.severity] - severityRank[b.severity]
    if (sev !== 0) return sev
    return b.occurrenceCount - a.occurrenceCount
  })
}

export async function scanVercelPlatformLogs(input = {}) {
  const rangeHours = input.sinceHours ?? DEFAULT_SCAN_HOURS
  const environment = input.environment ?? "production"

  if (!vercelAccessToken()) {
    return {
      scannedAt: new Date().toISOString(),
      rangeHours,
      environment,
      totalLogsFetched: 0,
      issueCount: 0,
      criticalCount: 0,
      warningCount: 0,
      issues: [],
      skippedReason:
        "VERCEL_ACCESS_TOKEN is not set — add your PAT to Cursor automation secrets",
    }
  }

  const context = await resolveProjectContext()
  if ("error" in context) {
    return {
      scannedAt: new Date().toISOString(),
      rangeHours,
      environment,
      totalLogsFetched: 0,
      issueCount: 0,
      criticalCount: 0,
      warningCount: 0,
      issues: [],
      skippedReason: context.error,
    }
  }

  const logs = await fetchRecentVercelRequestLogs({
    sinceHours: rangeHours,
    environment,
  })
  const issues = analyzeVercelRequestLogs(logs)
  const criticalCount = issues.filter((i) => i.severity === "critical").length
  const warningCount = issues.filter((i) => i.severity === "warning").length

  return {
    scannedAt: new Date().toISOString(),
    rangeHours,
    environment,
    totalLogsFetched: logs.length,
    issueCount: issues.length,
    criticalCount,
    warningCount,
    issues,
  }
}
