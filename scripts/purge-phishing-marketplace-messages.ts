import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  listPhishingMarketplaceMessages,
  purgePhishingMarketplaceMessages,
} from "@/lib/services/purgePhishingMarketplaceMessages"

function loadEnvFile(relativePath: string): void {
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

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const execute = process.argv.includes("--execute")
  const supabase = createClient(url, key)

  if (!execute) {
    const matches = await listPhishingMarketplaceMessages(supabase)
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          matchedCount: matches.length,
          messages: matches.map((row) => ({
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            created_at: row.created_at,
            contentPreview: row.content.slice(0, 160),
          })),
        },
        null,
        2,
      ),
    )
    console.log("\nDry run only. Re-run with --execute to permanently delete these messages.")
    return
  }

  const result = await purgePhishingMarketplaceMessages(supabase)
  console.log(JSON.stringify({ mode: "execute", ...result }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
