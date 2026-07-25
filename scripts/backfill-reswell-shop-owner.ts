/**
 * Reassign all Reswell shop listings (`section = new`) to the platform shop owner.
 *
 * Usage:
 *   npx tsx scripts/backfill-reswell-shop-owner.ts --dry-run
 *   npx tsx scripts/backfill-reswell-shop-owner.ts --apply
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"
import { resolveReswellShopOwnerUserId } from "@/lib/services/resolveReswellShopOwnerUser"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
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
  } catch {
    // optional
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const apply = process.argv.includes("--apply")
const dryRun = !apply

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const owner = await resolveReswellShopOwnerUserId(supabase)
  if (!owner.ok) {
    throw new Error(owner.error)
  }

  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, user_id, title, status")
    .eq("section", RESWELL_SHOP_SECTION)
    .neq("user_id", owner.userId)

  if (error) {
    throw new Error(error.message)
  }

  const toMove = rows ?? []
  console.log(
    `${dryRun ? "[dry-run] " : ""}Shop listings to reassign onto ${owner.userId}: ${toMove.length}`,
  )
  for (const row of toMove.slice(0, 25)) {
    console.log(`  - ${row.id}  ${row.status}  ${row.title}  (from ${row.user_id})`)
  }
  if (toMove.length > 25) {
    console.log(`  … and ${toMove.length - 25} more`)
  }

  if (dryRun) {
    console.log("\nRe-run with --apply to update user_id.")
    return
  }

  if (toMove.length === 0) {
    console.log("Nothing to update.")
    return
  }

  const ids = toMove.map((r) => r.id)
  const chunkSize = 100
  let updated = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { error: updErr, count } = await supabase
      .from("listings")
      .update({ user_id: owner.userId, updated_at: new Date().toISOString() })
      .in("id", chunk)
      .select("id", { count: "exact", head: true })
    if (updErr) {
      throw new Error(updErr.message)
    }
    updated += count ?? chunk.length
  }

  console.log(`Updated ${updated} shop listing(s) to platform owner ${owner.userId}.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
