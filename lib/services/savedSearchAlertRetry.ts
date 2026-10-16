import type { SupabaseClient } from "@supabase/supabase-js"
import {
  deleteExpiredSavedSearchAlertRetries,
  deleteSavedSearchAlertRetry,
  getSavedSearchAlertRetry,
  listDueSavedSearchAlertRetries,
  upsertSavedSearchAlertRetry,
  type SavedSearchAlertRetryRow,
} from "@/lib/db/savedSearchAlertRetry"
import {
  nextSavedSearchAlertRetry,
  SAVED_SEARCH_ALERT_RETRY_INTERVAL_MS,
} from "@/lib/services/savedSearchAlertRetryWindow"

/**
 * The listing is in the index (or the hour is over): stop retrying it.
 * A ready listing has already been matched on this pass.
 */
export async function clearSurfboardAlertRetry(
  service: SupabaseClient,
  listingId: string,
): Promise<void> {
  await deleteSavedSearchAlertRetry(service, listingId)
}

/**
 * Index was not ready. Remember another pass inside the hour after first publish.
 * `matchNow` is true for the first look and for each scheduled retry still inside the hour.
 * A later look after the hour is closed does not match again.
 */
export async function scheduleSurfboardAlertRetry(
  service: SupabaseClient,
  listingId: string,
  listedAt: string,
  now: Date,
): Promise<{ matchNow: boolean }> {
  const existing = await getSavedSearchAlertRetry(service, listingId)
  const attempts = existing?.attempts ?? 0
  const next = nextSavedSearchAlertRetry({ listedAt, now, attempts })
  if (!next) {
    if (existing) await deleteSavedSearchAlertRetry(service, listingId)
    return { matchNow: !existing }
  }
  await upsertSavedSearchAlertRetry(service, {
    listingId,
    attempts: next.attempts,
    nextAttemptAt: next.nextAttemptAt,
    giveUpAt: next.giveUpAt,
  })
  return { matchNow: true }
}

export async function listSurfboardAlertRetriesDue(
  service: SupabaseClient,
  now: Date,
): Promise<SavedSearchAlertRetryRow[]> {
  const grace = new Date(now.getTime() - SAVED_SEARCH_ALERT_RETRY_INTERVAL_MS).toISOString()
  await deleteExpiredSavedSearchAlertRetries(service, grace)
  return listDueSavedSearchAlertRetries(service, now.toISOString())
}
