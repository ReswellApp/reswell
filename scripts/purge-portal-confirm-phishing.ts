import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { deleteMarketplaceMessageAsAdmin } from "@/lib/db/adminMarketplaceMessages"
import { banUserAccounts } from "@/lib/services/banUserAccount"
import { purgePhishingMarketplaceMessages } from "@/lib/services/purgePhishingMarketplaceMessages"
import { messageAppearsToBePhishing } from "@/lib/utils/detect-message-phishing"

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

const BAN_REASON =
  "Permanent ban: phishing scam impersonating Reswell Support with PORTAL_CONFIRM payout lure."

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

  const { data: namedProfiles, error: namedError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .ilike("display_name", "%reswell support%")
  if (namedError) throw new Error(namedError.message)

  const senderIds = [...new Set((namedProfiles ?? []).map((row) => row.id))]
  const { data: fromSenders, error: fromSendersError } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .in("sender_id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"])
    .limit(1000)
  if (fromSendersError) throw new Error(fromSendersError.message)

  const leftoverFromSenders = (fromSenders ?? []).filter((row) =>
    messageAppearsToBePhishing(typeof row.content === "string" ? row.content : ""),
  )

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          impersonationProfiles: namedProfiles,
          messagesFromThoseAccounts: (fromSenders ?? []).length,
          phishingFromThoseAccounts: leftoverFromSenders.length,
        },
        null,
        2,
      ),
    )
    console.log("\nDry run only. Re-run with --execute to delete messages and ban accounts.")
    return
  }

  const purgeResult = await purgePhishingMarketplaceMessages(supabase)

  let extraDeleted = 0
  const extraErrors: string[] = []
  for (const row of leftoverFromSenders) {
    if (purgeResult.deletedMessageIds.includes(row.id)) continue
    const deleteResult = await deleteMarketplaceMessageAsAdmin(supabase, row.id)
    if (deleteResult.ok) {
      extraDeleted += 1
      continue
    }
    extraErrors.push(row.id)
  }

  const banResult = await banUserAccounts(supabase, senderIds, BAN_REASON)

  for (const userId of banResult.banned) {
    await supabase
      .from("profiles")
      .update({ display_name: `Restricted account ${userId.slice(0, 8)}` })
      .eq("id", userId)
  }

  const { data: remaining } = await supabase
    .from("messages")
    .select("id")
    .ilike("content", "%PORTAL_CONFIRM%")
    .limit(20)

  console.log(
    JSON.stringify(
      {
        mode: "execute",
        purgeResult,
        extraDeleted,
        extraErrors,
        banResult,
        remainingPortalConfirmCount: remaining?.length ?? 0,
      },
      null,
      2,
    ),
  )

  if (banResult.failed.length > 0 || extraErrors.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
