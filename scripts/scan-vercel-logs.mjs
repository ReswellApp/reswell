#!/usr/bin/env node
/**
 * Scan Vercel production logs for user-facing errors (CLI / automation).
 * Usage: npm run logs:scan [-- --hours 24]
 *
 * Loads .env.local and .env.production.local when present (production keys first).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile(relativePath) {
  const filePath = resolve(process.cwd(), relativePath)
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, "utf8")
  for (const line of content.split("\n")) {
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
    if (!value) continue
    if (process.env[key]?.trim()) continue
    process.env[key] = value
  }
}

function parseHours(argv) {
  const idx = argv.indexOf("--hours")
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number(argv[idx + 1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return 24
}

loadEnvFile(".env.local")
loadEnvFile(".env.production.local")

const hours = parseHours(process.argv.slice(2))

const { scanVercelLogs } = await import("../lib/services/vercelLogs.ts")

const result = await scanVercelLogs(hours)

console.log("")
console.log("=== Vercel log scan ===")
console.log(`Range: last ${result.rangeHours}h · scanned ${result.scannedAt}`)
console.log(
  `Deployments: ${result.deploymentsScanned} · raw logs: ${result.rawLogCount} · flagged: ${result.filteredLogCount}`,
)

if (result.skippedReason) {
  console.log("")
  console.log(`⚠ Scan could not run: ${result.skippedReason}`)
  process.exit(2)
}

console.log(`Critical: ${result.criticalCount} · Warnings: ${result.warningCount}`)
console.log("")

if (result.issues.length === 0) {
  console.log("No user-facing errors or warnings in this window.")
  process.exit(0)
}

for (const issue of result.issues) {
  const badge = issue.severity === "critical" ? "CRITICAL" : "WARNING "
  const status = issue.statusCode != null ? ` ${issue.statusCode}` : ""
  const count = issue.occurrences > 1 ? ` (×${issue.occurrences})` : ""
  console.log(
    `[${badge}] ${issue.method} ${issue.path}${status} — ${issue.message.slice(0, 160)}${count}`,
  )
}

process.exit(result.criticalCount > 0 ? 1 : 0)
