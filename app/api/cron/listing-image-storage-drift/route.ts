import { NextResponse } from "next/server"
import { scanListingImageStorageDrift } from "@/lib/services/listingImageStorageDriftScan"

/**
 * Daily sanity check: active listing photos whose storage objects are gone.
 * Does not mutate data — logs for alerting. Pair with scripts/audit-listing-image-storage.ts for repair.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await scanListingImageStorageDrift({ limit: 3000, activeListingsOnly: true })
    if (result.missing.length > 0) {
      console.error("[listing-image-storage-drift]", {
        scanned: result.scanned,
        missingCount: result.missing.length,
        sample: result.missing.slice(0, 20),
      })
    }
    return NextResponse.json({
      scanned: result.scanned,
      missingCount: result.missing.length,
      missingListingIds: [...new Set(result.missing.map((row) => row.listingId))],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed"
    console.error("[listing-image-storage-drift]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
