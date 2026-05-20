import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createGoogleMerchantPrimaryDataSource } from "../lib/services/googleMerchantSetup"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
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

async function main(): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") {
    loadEnvFile(".env.production.local")
  }

  const result = await createGoogleMerchantPrimaryDataSource("Reswell API Primary Feed")
  console.log(JSON.stringify(result, null, 2))

  if (!result.ok) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
