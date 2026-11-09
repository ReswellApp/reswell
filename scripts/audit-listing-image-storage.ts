/**
 * Finds listing_images rows whose full/thumb objects are missing from the listings bucket.
 *
 * Usage (with .env.local or env vars):
 *   npx tsx scripts/audit-listing-image-storage.ts
 *   npx tsx scripts/audit-listing-image-storage.ts --title="Channel Islands"
 *   npx tsx scripts/audit-listing-image-storage.ts --listing-id=<uuid> --fix-rows
 *
 * --fix-rows deletes listing_images rows with missing storage (does not touch storage).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { listingStorageObjectPathFromUrl } from "../lib/listing-media-src"

function loadEnvFile(relativePath: string): void {
  try {
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
  } catch {
    // optional
  }
}

function encodeStorageObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

async function storageObjectExists(bucket: string, path: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase env")

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectPath(path)}`,
    {
      method: "HEAD",
      headers: { Authorization: `Bearer ${serviceKey}` },
    },
  )
  return res.ok
}

type ListingImageRow = {
  id: string
  listing_id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  listings: {
    title: string | null
    status: string | null
    slug: string | null
  } | null
}

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error("Missing Supabase env")

  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 400)}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`))
  return hit ? hit.slice(flag.length + 1) : null
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const listingId = argValue("--listing-id")
  const titleFilter = argValue("--title")
  const fixRows = process.argv.includes("--fix-rows")
  const activeOnly = !process.argv.includes("--include-all-statuses")

  let query =
    "listing_images?select=id,listing_id,url,thumbnail_url,is_primary,listings!inner(title,status,slug)"
  const filters: string[] = []
  if (listingId) filters.push(`listing_id=eq.${listingId}`)
  if (activeOnly) filters.push("listings.status=eq.active")
  if (titleFilter) {
    const escaped = titleFilter.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
    filters.push(`listings.title=ilike.*${encodeURIComponent(escaped)}*`)
  }
  if (filters.length) query += `&${filters.join("&")}`
  query += "&order=listing_id.asc&limit=5000"

  let rows = await supabaseFetch<ListingImageRow[]>(query)
  if (titleFilter) {
    const needle = titleFilter.toLowerCase()
    rows = rows.filter((row) => (row.listings?.title ?? "").toLowerCase().includes(needle))
  }
  const missing: ListingImageRow[] = []

  for (const row of rows) {
    const fullPath = listingStorageObjectPathFromUrl(row.url)
    if (!fullPath) continue
    const fullOk = await storageObjectExists("listings", fullPath)
    let thumbOk = true
    const thumbPath =
      row.thumbnail_url?.trim() ? listingStorageObjectPathFromUrl(row.thumbnail_url) : null
    if (thumbPath && thumbPath !== fullPath) {
      thumbOk = await storageObjectExists("listings", thumbPath)
    }
    if (!fullOk || !thumbOk) missing.push(row)
  }

  console.log(`Scanned ${rows.length} listing_images row(s); ${missing.length} missing storage object(s).`)
  for (const row of missing) {
    const title = row.listings?.title ?? "(no title)"
    const status = row.listings?.status ?? "?"
    console.log(
      `- listing ${row.listing_id} [${status}] "${title}" image ${row.id} primary=${row.is_primary}`,
    )
    console.log(`  url: ${row.url}`)
    if (row.thumbnail_url) console.log(`  thumb: ${row.thumbnail_url}`)
  }

  if (fixRows && missing.length > 0) {
    const ids = missing.map((r) => r.id)
    await supabaseFetch<void>(`listing_images?id=in.(${ids.join(",")})`, { method: "DELETE" })
    console.log(`Deleted ${ids.length} listing_images row(s) with missing storage.`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
