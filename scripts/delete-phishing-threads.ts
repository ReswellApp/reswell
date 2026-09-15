import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { deleteMarketplaceConversationAsAdmin } from "@/lib/db/adminMarketplaceMessages"

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

const BANNED_SENDER_IDS = [
  "0bf646bd-6151-42ee-8e74-7146948b261a",
  "36924402-7c89-49b6-95a0-59c922563418",
  "7c5855f7-bfcc-4762-a2ac-d6c3f0d08404",
  "da848827-1a77-4081-9a99-4e412044fd8c",
  "06e5b32f-8ba5-4df9-b72f-34e29a359054",
  "4d904831-4e0e-4e67-ac1b-309227d4cab4",
  "b95797e7-e547-4af0-a1ee-018de3ef4b63",
  "e468353f-6557-460d-a69b-037570bcfc6f",
  "795a606f-2a34-4058-91d1-853e0b3a2ed4",
  "35d6fb22-c2b1-4fc8-a32d-a21c4f4a63a5",
  "ef91a9e8-cbd6-43a8-a9e2-cfa31cf9fb08",
] as const

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

  const [{ data: asBuyer, error: buyerError }, { data: asSeller, error: sellerError }] =
    await Promise.all([
      supabase.from("conversations").select("id, buyer_id, seller_id").in("buyer_id", [...BANNED_SENDER_IDS]),
      supabase.from("conversations").select("id, buyer_id, seller_id").in("seller_id", [...BANNED_SENDER_IDS]),
    ])
  if (buyerError) throw new Error(buyerError.message)
  if (sellerError) throw new Error(sellerError.message)

  const byId = new Map<string, { id: string; buyer_id: string; seller_id: string }>()
  for (const row of [...(asBuyer ?? []), ...(asSeller ?? [])]) {
    byId.set(row.id, row)
  }
  const threads = [...byId.values()]

  if (!execute) {
    console.log(JSON.stringify({ mode: "preview", threadCount: threads.length, threads }, null, 2))
    console.log("\nDry run only. Re-run with --execute to delete these threads.")
    return
  }

  const deleted: string[] = []
  const failed: string[] = []
  for (const thread of threads) {
    const result = await deleteMarketplaceConversationAsAdmin(supabase, thread.id)
    if (result.ok) deleted.push(thread.id)
    else failed.push(thread.id)
  }

  const [{ count: remainingBuyer }, { count: remainingSeller }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .in("buyer_id", [...BANNED_SENDER_IDS]),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .in("seller_id", [...BANNED_SENDER_IDS]),
  ])

  console.log(
    JSON.stringify(
      {
        mode: "execute",
        deletedCount: deleted.length,
        failed,
        remainingBuyer,
        remainingSeller,
      },
      null,
      2,
    ),
  )

  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
