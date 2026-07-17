import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { banUserAccounts } from "@/lib/services/banUserAccount"

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

/** Accounts that sent the Reswell impersonation / tinu.be phishing blast (2026-07-17). */
export const PHISHING_SCAM_SENDER_USER_IDS = [
  "0515c9f5-1c83-40bf-84b1-24c881bd9004",
  "b09d15bf-9646-4d97-bdd4-54d3831a21b6",
  "eef5c3bb-2646-47c5-810f-739fb68e1a6a",
  "f034a24e-a932-4788-be60-67a048de5a53",
  "52e6dbb0-70ee-4661-8dd7-34589dab8bd7",
] as const

const BAN_REASON =
  "Permanent ban: phishing scam impersonating Reswell support with tinu.be verification link."

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
    const previews = await Promise.all(
      PHISHING_SCAM_SENDER_USER_IDS.map(async (userId) => {
        const [{ data: profile }, { data: auth }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, account_restricted_until, account_restricted_reason")
            .eq("id", userId)
            .maybeSingle(),
          supabase.auth.admin.getUserById(userId),
        ])

        return {
          userId,
          displayName: profile?.display_name ?? null,
          accountRestrictedUntil: profile?.account_restricted_until ?? null,
          accountRestrictedReason: profile?.account_restricted_reason ?? null,
          bannedUntil: auth.user?.banned_until ?? null,
          email: auth.user?.email ?? null,
        }
      }),
    )

    console.log(
      JSON.stringify(
        {
          mode: "preview",
          userCount: PHISHING_SCAM_SENDER_USER_IDS.length,
          users: previews,
          banReason: BAN_REASON,
        },
        null,
        2,
      ),
    )
    console.log("\nDry run only. Re-run with --execute to permanently ban these accounts.")
    return
  }

  const result = await banUserAccounts(supabase, PHISHING_SCAM_SENDER_USER_IDS, BAN_REASON)
  console.log(JSON.stringify({ mode: "execute", banReason: BAN_REASON, ...result }, null, 2))

  if (result.failed.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
