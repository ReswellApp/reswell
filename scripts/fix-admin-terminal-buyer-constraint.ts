/**
 * One-off: drop stale POS buyer constraint blocking admin_terminal guest orders.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

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

async function main() {
  loadEnvFile(".env.local")
  const url = process.env.POSTGRES_URL?.trim()
  if (!url) {
    console.error("POSTGRES_URL missing")
    process.exit(1)
  }

  const sql = postgres(url, { ssl: "require", max: 1 })
  try {
    await sql.unsafe(
      "ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_pos"
    )
    await sql.unsafe(
      "ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_admin_terminal"
    )
    await sql.unsafe(
      "ALTER TABLE public.orders ADD CONSTRAINT orders_buyer_required_unless_admin_terminal CHECK (buyer_id IS NOT NULL OR sales_channel = 'admin_terminal')"
    )
    const rows = await sql`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.orders'::regclass
        AND conname LIKE '%buyer%'
    `
    console.log("orders buyer constraints:", rows)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
