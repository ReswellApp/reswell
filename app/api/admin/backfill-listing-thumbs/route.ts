/**
 * Admin route: backfill thumbnail_url for truly legacy listing images that
 * pre-date the -full./-thumb. naming convention (tier-3 images).
 *
 * Tier-1 (thumbnail_url already in DB): nothing to do.
 * Tier-2 (-full. in URL): run scripts/031_backfill_listing_image_thumbs_derived.sql once.
 * Tier-3 (no -full., no thumbnail_url): this route — fetches the original,
 *   resizes to 640px WebP with Sharp, uploads as {stem}-thumb.webp, updates DB.
 *
 * Usage:
 *   GET  /api/admin/backfill-listing-thumbs        — count of pending rows
 *   POST /api/admin/backfill-listing-thumbs        — process one batch
 *         body: { batchSize?: number }  (max 20, default 10)
 *
 * Run the POST in a loop (e.g. from a script) until `done: true` is returned.
 * The route is idempotent — re-running skips already-processed rows.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { resizeListingImageBufferToTileVariant } from "@/lib/media/listing-tile-variant-resize"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-proxy-url"

export const maxDuration = 60
export const runtime = "nodejs"

/** Returns the count of listing images that still need a thumbnail backfill. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const supabase = await createClient()
  const { count, error } = await supabase
    .from("listing_images")
    .select("*", { count: "exact", head: true })
    .is("thumbnail_url", null)
    .not("url", "like", "%-thumb.%")
    .not("url", "like", "%-full.%")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { pendingCount: count ?? 0 } })
}

/** Process one batch of legacy images — fetch, resize, upload thumb, update DB. */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => ({}))
  const batchSize = Math.min(Math.max(1, Number(body?.batchSize ?? 10)), 20)

  const supabase = await createClient()
  const sr = createServiceRoleClient()

  const { data: rows, error: queryError } = await supabase
    .from("listing_images")
    .select("id, url")
    .is("thumbnail_url", null)
    .not("url", "like", "%-thumb.%")
    .not("url", "like", "%-full.%")
    .limit(batchSize)

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json({ data: { processed: 0, updated: 0, errors: [], done: true } })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? ""
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const objectPath = listingStorageObjectPathFromUrl(row.url)
      if (!objectPath) {
        errors.push(`${row.id}: could not parse storage path from URL`)
        continue
      }

      // Fetch original from public storage URL
      const fetchResp = await fetch(row.url, { cache: "no-store" })
      if (!fetchResp.ok) {
        errors.push(`${row.id}: fetch ${fetchResp.status} ${fetchResp.statusText}`)
        continue
      }

      const originalBuffer = Buffer.from(await fetchResp.arrayBuffer())

      // Resize to 640px WebP using the same pipeline as the on-demand route
      const thumbBuffer = await resizeListingImageBufferToTileVariant(originalBuffer)

      // Derive thumb path: strip extension, append -thumb.webp
      const thumbObjectPath = objectPath.replace(/\.[^./]+$/, "") + "-thumb.webp"

      const { error: uploadError } = await sr.storage
        .from("listings")
        .upload(thumbObjectPath, thumbBuffer, {
          contentType: "image/webp",
          upsert: true,
        })

      if (uploadError) {
        errors.push(`${row.id}: storage upload — ${uploadError.message}`)
        continue
      }

      const thumbUrl = `${baseUrl}/storage/v1/object/public/listings/${thumbObjectPath}`

      const { error: updateError } = await sr
        .from("listing_images")
        .update({ thumbnail_url: thumbUrl })
        .eq("id", row.id)

      if (updateError) {
        errors.push(`${row.id}: DB update — ${updateError.message}`)
        continue
      }

      updated++
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    data: {
      processed: rows.length,
      updated,
      errors,
      done: rows.length < batchSize,
    },
  })
}
