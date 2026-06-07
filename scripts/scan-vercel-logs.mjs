#!/usr/bin/env node
/**
 * Scan production Vercel request logs for user-impacting errors and warnings.
 *
 * Requires:
 *   VERCEL_ACCESS_TOKEN  — https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID    — Project → Settings → General
 *   VERCEL_TEAM_ID       — Team Settings → General (or VERCEL_ORG_ID)
 *
 * Usage:
 *   node scripts/scan-vercel-logs.mjs
 *   node scripts/scan-vercel-logs.mjs --hours 6 --json
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
const projectId =
  process.env.VERCEL_PROJECT_ID?.trim() ||
  process.env.VERCEL_PROJECT?.trim() ||
  ""
const teamId =
  process.env.VERCEL_TEAM_ID?.trim() ||
  process.env.VERCEL_ORG_ID?.trim() ||
  ""

if (!token || !projectId || !teamId) {
  const missing = [
    !token && "VERCEL_ACCESS_TOKEN",
    !projectId && "VERCEL_PROJECT_ID",
    !teamId && "VERCEL_TEAM_ID",
  ].filter(Boolean)
  console.error(
    `[scan-vercel-logs] Missing required env: ${missing.join(", ")}`,
  )
  console.error(
    "[scan-vercel-logs] Add them to Vercel env vars or pull with: npm run env:pull",
  )
  process.exit(2)
}

const sinceMs = Date.now() - Math.max(1, hours) * 60 * 60 * 1000
const untilMs = Date.now()

async function fetchPage(page) {
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

function classify(row) {
  const path = row.requestPath || "/"
  const status = row.statusCode ?? 0
  const level = worstLevel(row.logs)
  const message = runtimeMessage(row)

  if (path.startsWith("/api/cron/") || path.startsWith("/_next/")) return null
  if (
    status === 404 &&
    (path.endsWith(".php") || path.includes("wp-admin") || path.includes(".git"))
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
      timestamp: row.timestamp,
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
      message: message || `${level} runtime log`,
      timestamp: row.timestamp,
      requestId: row.requestId,
    }
  }

  const userFacing4xx = [400, 403, 408, 409, 422, 429].includes(status)
  if (
    userFacing4xx &&
    (path.startsWith("/api/") || path.startsWith("/checkout") || path.startsWith("/auth"))
  ) {
    return {
      severity: "warning",
      category: "client_error",
      method: row.requestMethod ?? "",
      path,
      status,
      level,
      message: message || `HTTP ${status}`,
      timestamp: row.timestamp,
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
      timestamp: row.timestamp,
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
      grouped.set(key, { ...issue, count: 1, requestIds: issue.requestId ? [issue.requestId] : [] })
      continue
    }
    existing.count += 1
    if (issue.requestId && existing.requestIds.length < 3 && !existing.requestIds.includes(issue.requestId)) {
      existing.requestIds.push(issue.requestId)
    }
  }
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1
    return b.count - a.count
  })
}

async function main() {
  const rows = []
  for (let page = 0; page < 10; page += 1) {
    const data = await fetchPage(page)
    const batch = data.rows ?? []
    rows.push(...batch)
    if (!data.hasMoreRows || batch.length === 0) break
  }

  const issues = groupIssues(
    rows.map(classify).filter(Boolean),
  )

  const summary = {
    scannedAt: new Date().toISOString(),
    rangeHours: hours,
    environment: "production",
    totalLogsFetched: rows.length,
    issueCount: issues.length,
    criticalCount: issues.filter((i) => i.severity === "critical").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    issues,
  }

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2))
    process.exit(summary.issueCount > 0 ? 1 : 0)
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
    console.log(`[${flag}] ${issue.method} ${issue.path} → ${issue.status || "—"} (${issue.count}x)`)
    console.log(`  ${issue.message}`)
    if (issue.requestIds?.length) {
      console.log(`  request ids: ${issue.requestIds.join(", ")}`)
    }
    console.log("")
  }

  process.exit(summary.criticalCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("[scan-vercel-logs] failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
