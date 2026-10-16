import type { SupabaseClient } from "@supabase/supabase-js"

export type SavedSearchAlertRetryRow = {
  listingId: string
  attempts: number
  nextAttemptAt: string
  giveUpAt: string
}

type RetryDbRow = {
  listing_id: string
  attempts: number
  next_attempt_at: string
  give_up_at: string
}

function toRetryRow(row: RetryDbRow): SavedSearchAlertRetryRow {
  return {
    listingId: row.listing_id,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    giveUpAt: row.give_up_at,
  }
}

export async function getSavedSearchAlertRetry(
  service: SupabaseClient,
  listingId: string,
): Promise<SavedSearchAlertRetryRow | null> {
  const { data, error } = await service
    .from("saved_search_alert_retries")
    .select("listing_id, attempts, next_attempt_at, give_up_at")
    .eq("listing_id", listingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.listing_id) return null
  return toRetryRow(data as RetryDbRow)
}

export async function upsertSavedSearchAlertRetry(
  service: SupabaseClient,
  row: SavedSearchAlertRetryRow,
): Promise<void> {
  const { error } = await service.from("saved_search_alert_retries").upsert(
    {
      listing_id: row.listingId,
      attempts: row.attempts,
      next_attempt_at: row.nextAttemptAt,
      give_up_at: row.giveUpAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" },
  )
  if (error) throw new Error(error.message)
}

export async function deleteSavedSearchAlertRetry(
  service: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await service.from("saved_search_alert_retries").delete().eq("listing_id", listingId)
  if (error) throw new Error(error.message)
}

/** Retries whose next pass is due. Capped so one cron tick stays short. */
export async function listDueSavedSearchAlertRetries(
  service: SupabaseClient,
  nowIso: string,
  limit = 50,
): Promise<SavedSearchAlertRetryRow[]> {
  const { data, error } = await service
    .from("saved_search_alert_retries")
    .select("listing_id, attempts, next_attempt_at, give_up_at")
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as RetryDbRow[]).map(toRetryRow)
}

export async function deleteExpiredSavedSearchAlertRetries(
  service: SupabaseClient,
  giveUpBeforeIso: string,
): Promise<void> {
  const { error } = await service
    .from("saved_search_alert_retries")
    .delete()
    .lt("give_up_at", giveUpBeforeIso)
  if (error) throw new Error(error.message)
}
