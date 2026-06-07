#!/usr/bin/env node
/**
 * Scan production Vercel request logs for user-impacting errors and warnings.
 *
 * Requires VERCEL_ACCESS_TOKEN (project/team IDs auto-discovered when unset).
 *
 * Usage:
 *   npm run logs:scan
 *   npm run logs:scan -- --hours 6 --json
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

const { scanVercelPlatformLogs } = await import(
  "../lib/services/vercelRequestLogMonitor.ts"
)

const summary = await scanVercelPlatformLogs({
  sinceHours: Math.max(1, hours),
  environment: "production",
})

if (summary.skippedReason) {
  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.error(`[scan-vercel-logs] ${summary.skippedReason}`)
    console.error(
      "[scan-vercel-logs] Add VERCEL_ACCESS_TOKEN to Vercel env or pull with: npm run env:pull",
    )
  }
  process.exit(2)
}

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(summary.issueCount > 0 ? 1 : 0)
}

console.log(`Vercel log scan — last ${summary.rangeHours}h (${summary.environment})`)
console.log(`Fetched ${summary.totalLogsFetched} request log rows`)
console.log(
  `Found ${summary.issueCount} issue groups (${summary.criticalCount} critical, ${summary.warningCount} warning)`,
)
console.log("")

if (summary.issues.length === 0) {
  console.log("No user-impacting errors or warnings detected.")
  process.exit(0)
}

for (const issue of summary.issues) {
  const flag = issue.severity === "critical" ? "CRITICAL" : "WARNING"
  console.log(
    `[${flag}] ${issue.requestMethod} ${issue.requestPath} → ${issue.responseStatusCode || "—"} (${issue.occurrenceCount}x)`,
  )
  console.log(`  ${issue.message}`)
  if (issue.sampleRequestIds?.length) {
    console.log(`  request ids: ${issue.sampleRequestIds.join(", ")}`)
  }
  console.log("")
}

process.exit(summary.criticalCount > 0 ? 1 : 0)
