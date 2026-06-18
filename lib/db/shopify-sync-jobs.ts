import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifySyncJobRow, ShopifySyncJobType } from "@/lib/shopify/types"

const JOB_SELECT =
  "id, user_id, connection_id, job_type, payload, status, attempts, max_attempts, run_after, locked_at, locked_by, last_error, dedupe_key, created_at, updated_at" as const

export interface EnqueueShopifyJobInput {
  userId: string | null
  connectionId: string | null
  jobType: ShopifySyncJobType
  payload?: Record<string, unknown>
  /** Coalesce repeated work (e.g. inventory bursts) into one queued job. */
  dedupeKey?: string | null
  /** Delay execution until this time (used for backoff / scheduled reconcile). */
  runAfter?: Date | null
  maxAttempts?: number
}

/**
 * Enqueue a durable sync job. When a {@link EnqueueShopifyJobInput.dedupeKey} is supplied and a
 * queued/running job already holds it, the insert is a no-op (unique partial index).
 */
export async function enqueueShopifySyncJob(
  supabase: SupabaseClient,
  input: EnqueueShopifyJobInput,
): Promise<{ enqueued: boolean }> {
  const { error } = await supabase.from("shopify_sync_jobs").insert({
    user_id: input.userId,
    connection_id: input.connectionId,
    job_type: input.jobType,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
    run_after: (input.runAfter ?? new Date()).toISOString(),
    max_attempts: input.maxAttempts ?? 5,
  })

  if (error) {
    // 23505 = unique_violation → a matching job is already queued; treat as coalesced.
    if ((error as { code?: string }).code === "23505") {
      return { enqueued: false }
    }
    throw new Error(error.message)
  }
  return { enqueued: true }
}

export async function claimShopifySyncJobs(
  supabase: SupabaseClient,
  limit: number,
  worker: string,
): Promise<ShopifySyncJobRow[]> {
  const { data, error } = await supabase.rpc("claim_shopify_sync_jobs", {
    p_limit: limit,
    p_worker: worker,
  })
  if (error) throw new Error(error.message)
  return (data as ShopifySyncJobRow[]) ?? []
}

export async function markShopifySyncJobSucceeded(
  supabase: SupabaseClient,
  jobId: string,
): Promise<void> {
  await supabase
    .from("shopify_sync_jobs")
    .update({
      status: "succeeded",
      locked_at: null,
      locked_by: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

/**
 * Mark a job failed. If attempts remain, requeue with exponential backoff; otherwise dead-letter.
 */
export async function markShopifySyncJobFailed(
  supabase: SupabaseClient,
  job: Pick<ShopifySyncJobRow, "id" | "attempts" | "max_attempts">,
  errorMessage: string,
): Promise<void> {
  const exhausted = job.attempts >= job.max_attempts
  const backoffMs = Math.min(60 * 60 * 1000, 2 ** job.attempts * 30 * 1000)
  await supabase
    .from("shopify_sync_jobs")
    .update({
      status: exhausted ? "dead" : "failed",
      run_after: new Date(Date.now() + backoffMs).toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
}

export async function listShopifySyncJobsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<ShopifySyncJobRow[]> {
  const { data, error } = await supabase
    .from("shopify_sync_jobs")
    .select(JOB_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as ShopifySyncJobRow[]) ?? []
}
