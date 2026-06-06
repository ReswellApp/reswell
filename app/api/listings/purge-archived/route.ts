import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteListingDocument } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import {
  fetchListingImageUrlsForListingIds,
  removeListingImageFilesFromStorage,
} from "@/lib/services/listingStorageCleanup"
import { NextResponse } from "next/server"
import { revalidateSellersForUserIds } from "@/lib/cache/revalidate-sellers-directory-catalog"

const ARCHIVE_DAYS = 30

/**
 * Deletes listings that have been archived for more than ARCHIVE_DAYS.
 * Call from a cron job (e.g. Vercel Cron). Use a secret in the URL or env so only cron can call it.
 * GET so it can be triggered by a cron URL.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ARCHIVE_DAYS)
  const cutoffIso = cutoff.toISOString()

  const { data: toDelete, error: fetchError } = await supabase
    .from("listings")
    .select("id, user_id")
    .not("archived_at", "is", null)
    .lt("archived_at", cutoffIso)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!toDelete?.length) {
    return NextResponse.json({ deleted: 0, message: "No listings to purge" })
  }

  const ids = toDelete.map((r) => r.id)
  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, ids)

  const { error: deleteError } = await supabase
    .from("listings")
    .delete()
    .in("id", ids)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  for (const id of ids) {
    try {
      await deleteListingDocument(id)
    } catch {
      /* ES optional */
    }
    void syncListingToGoogleMerchantBestEffort(supabase, id)
  }

  try {
    await removeListingImageFilesFromStorage(supabase, imageUrls)
  } catch {
    /* best-effort storage cleanup */
  }

  const sellerUserIds = (toDelete ?? [])
    .map((row) => (row as { user_id?: string | null }).user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  await revalidateSellersForUserIds(supabase, sellerUserIds)

  return NextResponse.json({ deleted: ids.length, ids })
}
