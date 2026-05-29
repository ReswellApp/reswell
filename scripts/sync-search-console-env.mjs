#!/usr/bin/env node
/**
 * Copies Search Console + GCP WIF vars from .env.production.local into .env.local
 * when missing. `next dev` only loads .env.local; Vercel development env often omits
 * production-only keys.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const localPath = resolve(root, ".env.local")
const prodPath = resolve(root, ".env.production.local")

const KEYS = [
  "GOOGLE_SEARCH_CONSOLE_SITE_URL",
  "GCP_PROJECT_NUMBER",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
]

function parseEnv(text) {
  const map = new Map()
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=/)
    if (m) map.set(m[1], line)
  }
  return map
}

if (!existsSync(prodPath)) {
  console.warn("[sync-search-console-env] .env.production.local not found; run: vercel env pull .env.production.local --environment=production --yes")
  process.exit(0)
}

if (!existsSync(localPath)) {
  console.warn("[sync-search-console-env] .env.local not found; run: vercel env pull .env.local --yes")
  process.exit(0)
}

const prod = parseEnv(readFileSync(prodPath, "utf8"))
let localText = readFileSync(localPath, "utf8")
const local = parseEnv(localText)

const added = []
function valueFromLine(line) {
  const raw = line.slice(line.indexOf("=") + 1).trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

for (const key of KEYS) {
  if (local.has(key)) continue
  const line = prod.get(key)
  if (!line) continue
  if (!valueFromLine(line)) {
    console.warn(`[sync-search-console-env] skip ${key} (empty on production pull — set in Vercel or use vercel dev)`)
    continue
  }
  localText = localText.endsWith("\n") ? localText : `${localText}\n`
  localText += `${line}\n`
  added.push(key)
}

if (added.length === 0) {
  console.log("[sync-search-console-env] .env.local already has Search Console / GCP WIF vars")
} else {
  writeFileSync(localPath, localText)
  console.log(`[sync-search-console-env] added to .env.local: ${added.join(", ")}`)
  console.log("[sync-search-console-env] restart `npm run dev` to pick up changes")
}
