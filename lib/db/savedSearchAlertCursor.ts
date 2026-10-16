import type { SupabaseClient } from "@supabase/supabase-js"

/** Board Finder catch-up watermark (`listing_creation_events.listed_at`). */
export const SURFBOARD_NEW_LISTING_ALERT_JOB = "surfboard_new_listings"

export async function getSavedSearchAlertCursor(
  service: SupabaseClient,
  job: string,
): Promise<{ listedThrough: string } | null> {
  const { data, error } = await service
    .from("saved_search_alert_cursors")
    .select("listed_through")
    .eq("job", job)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  const listedThrough = data?.listed_through
  if (typeof listedThrough !== "string" || !listedThrough) return null
  return { listedThrough }
}

export async function setSavedSearchAlertCursor(
  service: SupabaseClient,
  job: string,
  listedThrough: string,
): Promise<void> {
  const { error } = await service.from("saved_search_alert_cursors").upsert(
    {
      job,
      listed_through: listedThrough,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job" },
  )
  if (error) {
    throw new Error(error.message)
  }
}
