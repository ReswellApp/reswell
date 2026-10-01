#!/usr/bin/env node
/**
 * Scan production Vercel request logs for errors and warnings (last 24h by default).
 *
 * Requires VERCEL_ACCESS_TOKEN (project/team IDs auto-discovered when unset),
 * or CRON_SECRET to call production `GET /api/cron/vercel-error-digest`.
 *
 * Usage:
 *   npm run audit
 *   npm run logs:scan
 *   npm run logs:scan -- --hours 24 --report
 *   npm run logs:scan -- --json
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

function loadDotEnvFile(filename) {
  const path = join(process.cwd(), filename)
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnvFile(".env.local")
loadDotEnvFile(".env.production.local")

const args = process.argv.slice(2)
const jsonOutput = args.includes("--json")
const reportOutput = args.includes("--report")
const hoursArg = args.find((a) => a.startsWith("--hours="))
const hoursFlagIndex = args.indexOf("--hours")
const hours =
  hoursArg != null
    ? Number(hoursArg.split("=")[1])
    : hoursFlagIndex >= 0
      ? Number(args[hoursFlagIndex + 1])
      : 24

const token =
  process.env.VERCEL_ACCESS_TOKEN?.trim() ||
  process.env.VERCEL_TOKEN?.trim() ||
  ""

const cronSecret = process.env.CRON_SECRET?.trim() || ""
const cronDigestUrl =
  process.env.VERCEL_ERROR_DIGEST_URL?.trim() ||
  "https://www.reswell.app/api/cron/vercel-error-digest"

function vercelProjectId() {
  return (
    process.env.VERCEL_PROJECT_ID?.trim() ||
    process.env.VERCEL_PROJECT?.trim() ||
    ""
  )
}

function vercelTeamId() {
  return (
    process.env.VERCEL_TEAM_ID?.trim() ||
    process.env.VERCEL_ORG_ID?.trim() ||
    ""
  )
}

function mapCronIssue(issue) {
  return {
    severity: issue.severity,
    category: issue.category,
    method: issue.requestMethod ?? "",
    path: issue.requestPath ?? "/",
    status: issue.responseStatusCode ?? 0,
    level: issue.level ?? "error",
    message: issue.message ?? "",
    source: issue.source ?? "serverless",
    count: issue.occurrenceCount ?? 1,
    firstSeenAt: Date.parse(issue.firstSeenAt),
    lastSeenAt: Date.parse(issue.lastSeenAt),
    requestIds: issue.sampleRequestIds ?? [],
  }
}

async function fetchViaCronDigest() {
  if (!cronSecret) {
    return {
      error:
        "Neither VERCEL_ACCESS_TOKEN nor CRON_SECRET is set — add one to Cursor Automation → Secrets",
    }
  }

  const url = `${cronDigestUrl}?hours=${Math.max(1, hours)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return {
      error: `Production vercel-error-digest failed (${res.status}): ${text.slice(0, 200)}`,
    }
  }

  const data = await res.json()
  const scan = data.summary?.scan
  if (!scan) {
    return { error: "Production vercel-error-digest returned an unexpected payload." }
  }

  if (scan.skippedReason) {
    return { error: scan.skippedReason }
  }

  const issues = (scan.issues ?? []).map(mapCronIssue)
  return {
    summary: {
      scannedAt: scan.scannedAt ?? new Date().toISOString(),
      rangeHours: scan.rangeHours ?? hours,
      environment: scan.environment ?? "production",
      totalLogsFetched: scan.totalLogsFetched ?? 0,
      issueCount: scan.issueCount ?? issues.length,
      criticalCount: scan.criticalCount ?? issues.filter((i) => i.severity === "critical").length,
      warningCount: scan.warningCount ?? issues.filter((i) => i.severity === "warning").length,
      issues,
    },
  }
}

async function resolveProjectContext() {
  if (!token) {
    return {
      error:
        "VERCEL_ACCESS_TOKEN is not set — create a token at https://vercel.com/account/tokens",
    }
  }

  const projectId = vercelProjectId()
  const teamId = vercelTeamId()
  if (projectId && teamId) return { projectId, teamId }

  const res = await fetch("https://api.vercel.com/v9/projects?limit=50", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
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

  const resolvedProjectId = projectId || preferred.id
  const resolvedTeamId = teamId || preferred.accountId

  if (!resolvedProjectId || !resolvedTeamId) {
    return {
      error:
        "Could not resolve VERCEL_PROJECT_ID / VERCEL_TEAM_ID — set them in Vercel → Project → Settings → General",
    }
  }

  return { projectId: resolvedProjectId, teamId: resolvedTeamId }
}

const sinceMs = Date.now() - Math.max(1, hours) * 60 * 60 * 1000
const untilMs = Date.now()

async function fetchPage(projectId, teamId, page) {
  const query = new URLSearchParams({
    projectId,
    ownerId: teamId,
    page: String(page),
    startDate: String(sinceMs),
    endDate: String(untilMs),
    environment: "production",
  })
  const url = `https://vercel.com/api/logs/request-logs?${query.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Vercel API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

function worstLevel(logs) {
  const order = { info: 0, warning: 1, error: 2, fatal: 3 }
  let worst = "info"
  for (const log of logs ?? []) {
    if ((order[log.level] ?? -1) > (order[worst] ?? -1)) worst = log.level
  }
  return worst
}

function runtimeMessage(row) {
  const lines = (row.logs ?? [])
    .filter((l) => ["error", "fatal", "warning"].includes(l.level))
    .map((l) => l.message?.trim())
    .filter(Boolean)
  return (lines.join(" | ") || "").slice(0, 500)
}

function firstEventSource(row) {
  return row.events?.[0]?.source ?? "static"
}

function classify(row) {
  const path = row.requestPath || "/"
  const status = row.statusCode ?? 0
  const level = worstLevel(row.logs)
  const message = runtimeMessage(row)
  const source = firstEventSource(row)
  const ts = row.timestamp ? Date.parse(row.timestamp) : Date.now()

  if (
    path.startsWith("/api/cron/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/media/")
  ) {
    return null
  }
  if (
    status === 404 &&
    (path.endsWith(".php") ||
      path.endsWith(".env") ||
      path.includes("wp-admin") ||
      path.includes("wp-login") ||
      path.includes(".git"))
  ) {
    return null
  }

  if (status >= 500) {
    return {
      severity: "critical",
      category: "server_error",
      method: row.requestMethod ?? "",
      path,
      status,
      level: level === "info" ? "error" : level,
      message: message || `HTTP ${status}`,
      source,
      timestamp: ts,
      requestId: row.requestId,
    }
  }

  if (level === "fatal" || level === "error") {
    return {
      severity: "critical",
      category: "runtime_error",
      method: row.requestMethod ?? "",
      path,
      status,
      level,
      message: message || `${level} in ${source}`,
      source,
      timestamp: ts,
      requestId: row.requestId,
    }
  }

  const userFacing4xx = [400, 403, 408, 409, 422, 429].includes(status)
  if (
    userFacing4xx &&
    (path.startsWith("/api/") ||
      path.startsWith("/checkout") ||
      path.startsWith("/auth"))
  ) {
    return {
      severity: "warning",
      category: "client_error",
      method: row.requestMethod ?? "",
      path,
      status,
      level,
      message: message || `HTTP ${status}`,
      source,
      timestamp: ts,
      requestId: row.requestId,
    }
  }

  if (level === "warning") {
    return {
      severity: "warning",
      category: "runtime_warning",
      method: row.requestMethod ?? "",
      path,
      status,
      level,
      message: message || "Runtime warning",
      source,
      timestamp: ts,
      requestId: row.requestId,
    }
  }

  return null
}

function groupIssues(issues) {
  const grouped = new Map()
  for (const issue of issues) {
    const key = [
      issue.severity,
      issue.category,
      issue.method,
      issue.path,
      issue.status,
      issue.message.slice(0, 120),
    ].join("|")
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        ...issue,
        count: 1,
        firstSeenAt: issue.timestamp,
        lastSeenAt: issue.timestamp,
        requestIds: issue.requestId ? [issue.requestId] : [],
      })
      continue
    }
    existing.count += 1
    if (issue.timestamp < existing.firstSeenAt) existing.firstSeenAt = issue.timestamp
    if (issue.timestamp > existing.lastSeenAt) existing.lastSeenAt = issue.timestamp
    if (
      issue.requestId &&
      existing.requestIds.length < 3 &&
      !existing.requestIds.includes(issue.requestId)
    ) {
      existing.requestIds.push(issue.requestId)
    }
  }
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1
    return b.count - a.count
  })
}

function formatRoute(issue) {
  const route = `${issue.method} ${issue.path}`.trim()
  return route || issue.source || "unknown"
}

function formatTime(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

function printReport(summary) {
  const errors = summary.issues.filter((i) => i.severity === "critical")
  const warnings = summary.issues.filter((i) => i.severity === "warning")
  const totalErrorOccurrences = errors.reduce((n, i) => n + i.count, 0)
  const totalWarningOccurrences = warnings.reduce((n, i) => n + i.count, 0)

  let health
  if (totalErrorOccurrences === 0 && totalWarningOccurrences === 0) health = "🟢 clean"
  else if (totalErrorOccurrences === 0) health = "🟡 warnings only"
  else health = "🔴 errors present"

  if (totalErrorOccurrences === 0 && totalWarningOccurrences === 0) {
    console.log(
      `No errors or warnings in production Vercel logs for the last ${summary.rangeHours}h.`,
    )
    return
  }

  console.log("## Summary")
  console.log(
    `- Errors: ${totalErrorOccurrences} (${errors.length} unique groups)`,
  )
  console.log(
    `- Warnings: ${totalWarningOccurrences} (${warnings.length} unique groups)`,
  )
  console.log(`- Health: ${health}`)
  console.log("")

  if (errors.length > 0) {
    console.log("## Errors")
    for (const issue of errors) {
      const flags = []
      if (issue.category === "server_error") flags.push("5xx")
      if (issue.count >= 10) flags.push("spike")
      const flagText = flags.length ? ` [${flags.join(", ")}]` : ""
      console.log(
        `- **${issue.message}** (${issue.count}x)${flagText}`,
      )
      console.log(`  - Route: ${formatRoute(issue)}`)
      console.log(
        `  - First: ${formatTime(issue.firstSeenAt)} · Last: ${formatTime(issue.lastSeenAt)}`,
      )
    }
    console.log("")
  }

  if (warnings.length > 0) {
    console.log("## Warnings")
    for (const issue of warnings) {
      console.log(`- **${issue.message}** (${issue.count}x)`)
      console.log(`  - Route: ${formatRoute(issue)}`)
      console.log(
        `  - First: ${formatTime(issue.firstSeenAt)} · Last: ${formatTime(issue.lastSeenAt)}`,
      )
    }
    console.log("")
  }

  console.log("## Recommended actions")
  const top = summary.issues[0]
  if (top?.severity === "critical") {
    console.log(
      `1. Investigate ${top.method} ${top.path} (${top.count}x) — ${top.message.slice(0, 120)}`,
    )
  }
  const spike = summary.issues.find((i) => i.count >= 10)
  if (spike && spike !== top) {
    console.log(
      `2. Check spike on ${spike.method} ${spike.path} (${spike.count} occurrences in ${summary.rangeHours}h)`,
    )
  }
  console.log(
    "3. Review full logs: https://vercel.com/dashboard/logs?environment=production",
  )
}

async function buildSummaryFromVercelApi() {
  const context = await resolveProjectContext()
  if ("error" in context) return context

  const rows = []
  for (let page = 0; page < 10; page += 1) {
    const data = await fetchPage(context.projectId, context.teamId, page)
    const batch = data.rows ?? []
    rows.push(...batch)
    if (!data.hasMoreRows || batch.length === 0) break
  }

  const issues = groupIssues(rows.map(classify).filter(Boolean))

  return {
    summary: {
      scannedAt: new Date().toISOString(),
      rangeHours: hours,
      environment: "production",
      totalLogsFetched: rows.length,
      issueCount: issues.length,
      criticalCount: issues.filter((i) => i.severity === "critical").length,
      warningCount: issues.filter((i) => i.severity === "warning").length,
      issues,
    },
  }
}

async function main() {
  let result = token
    ? await buildSummaryFromVercelApi()
    : await fetchViaCronDigest()

  if ("error" in result && token && cronSecret) {
    result = await fetchViaCronDigest()
  }

  if ("error" in result) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            scannedAt: new Date().toISOString(),
            rangeHours: hours,
            environment: "production",
            skippedReason: result.error,
          },
          null,
          2,
        ),
      )
    } else {
      console.error(`[scan-vercel-logs] ${result.error}`)
      console.error(
        "[scan-vercel-logs] Add VERCEL_ACCESS_TOKEN or CRON_SECRET to Cursor Automation → Secrets",
      )
    }
    process.exit(2)
  }

  const summary = result.summary
  const issues = summary.issues

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2))
    process.exit(summary.issueCount > 0 ? 1 : 0)
  }

  if (reportOutput) {
    printReport(summary)
    process.exit(summary.criticalCount > 0 ? 1 : 0)
  }

  console.log(`Vercel log scan — last ${hours}h (production)`)
  console.log(`Fetched ${summary.totalLogsFetched} request log rows`)
  console.log(
    `Found ${summary.issueCount} issue groups (${summary.criticalCount} critical, ${summary.warningCount} warning)`,
  )
  console.log("")

  if (issues.length === 0) {
    console.log("No user-impacting errors or warnings detected.")
    process.exit(0)
  }

  for (const issue of issues) {
    const flag = issue.severity === "critical" ? "CRITICAL" : "WARNING"
    console.log(
      `[${flag}] ${issue.method} ${issue.path} → ${issue.status || "—"} (${issue.count}x)`,
    )
    console.log(`  ${issue.message}`)
    if (issue.requestIds?.length) {
      console.log(`  request ids: ${issue.requestIds.join(", ")}`)
    }
    console.log("")
  }

  process.exit(summary.criticalCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(
    "[scan-vercel-logs] failed:",
    err instanceof Error ? err.message : err,
  )
  process.exit(1)
})
