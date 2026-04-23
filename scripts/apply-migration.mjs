import { readFileSync } from "node:fs"
import { Client } from "pg"

const file = process.argv[2]
if (!file) {
  console.error("Usage: node apply-migration.mjs <path-to-sql>")
  process.exit(1)
}

const url = process.env.POSTGRES_URL_NON_POOLING
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING not set")
  process.exit(1)
}

const sql = readFileSync(file, "utf8")
const cleanUrl = url.replace(/\?.*$/, "")
const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } })

await client.connect()
try {
  await client.query(sql)
  // Force PostgREST schema cache reload so new tables/columns are visible immediately.
  await client.query("NOTIFY pgrst, 'reload schema'")
  console.log("Migration applied:", file)
} finally {
  await client.end()
}
