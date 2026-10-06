import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ShopifySyncJobRow,
  ShopifySyncJobType,
  ShopifyWebhookEventRow,
} from "@/lib/shopify/types"

export async function dbInsertShopifyWebhookEvent(
  supabase: SupabaseClient,
  input: {
    connectionId: string | null
    shopDomain: string
    webhookId: string
    topic: string
    payload: Record<string, unknown>
  },
): Promise<"inserted" | "duplicate"> {
  const { error } = await supabase.from("shopify_webhook_events").insert({
    connection_id: input.connectionId,
    shop_domain: input.shopDomain,
    webhook_id: input.webhookId,
    topic: input.topic,
    payload: input.payload,
  })
  if (!error) return "inserted"
  if (error.code === "23505") return "duplicate"
  throw new Error(error.message)
}

export async function dbClaimShopifyWebhookEvents(
  supabase: SupabaseClient,
  input: { limit: number; workerId: string },
): Promise<ShopifyWebhookEventRow[]> {
  const { data, error } = await supabase.rpc("claim_shopify_webhook_events", {
    p_limit: input.limit,
    p_worker: input.workerId,
    p_lease_seconds: 120,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifyWebhookEventRow[]
}

export async function dbCompleteShopifyWebhookEvent(
  supabase: SupabaseClient,
  event: Pick<ShopifyWebhookEventRow, "id" | "worker_id">,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("shopify_webhook_events")
    .update({
      status: "processed",
      processed_at: now,
      locked_until: null,
      worker_id: null,
      last_error: null,
      updated_at: now,
    })
    .eq("id", event.id)
    .eq("status", "processing")
    .eq("worker_id", event.worker_id)
  if (error) throw new Error(error.message)
}

export async function dbFailShopifyWebhookEvent(
  supabase: SupabaseClient,
  event: Pick<
    ShopifyWebhookEventRow,
    "id" | "attempts" | "max_attempts" | "worker_id"
  >,
  errorMessage: string,
): Promise<void> {
  const dead = event.attempts >= event.max_attempts
  const delayMs = Math.min(60 * 60_000, 2 ** event.attempts * 15_000)
  const { error } = await supabase
    .from("shopify_webhook_events")
    .update({
      status: dead ? "dead" : "retry",
      available_at: new Date(Date.now() + delayMs).toISOString(),
      locked_until: null,
      worker_id: null,
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id)
    .eq("status", "processing")
    .eq("worker_id", event.worker_id)
  if (error) throw new Error(error.message)
}

export async function dbEnqueueShopifyJob(
  supabase: SupabaseClient,
  input: {
    connectionId: string
    jobType: ShopifySyncJobType
    payload?: Record<string, unknown>
    dedupeKey?: string | null
    idempotencyKey?: string | null
    runAfter?: string
  },
): Promise<boolean> {
  const { error } = await supabase.from("shopify_sync_jobs").insert({
    connection_id: input.connectionId,
    job_type: input.jobType,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    run_after: input.runAfter ?? new Date().toISOString(),
  })
  if (!error) return true
  if (error.code === "23505") return false
  throw new Error(error.message)
}

export async function dbClaimShopifyJobs(
  supabase: SupabaseClient,
  input: { limit: number; workerId: string },
): Promise<ShopifySyncJobRow[]> {
  const { data, error } = await supabase.rpc("claim_shopify_sync_jobs", {
    p_limit: input.limit,
    p_worker: input.workerId,
    p_lease_seconds: 180,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifySyncJobRow[]
}

export async function dbCompleteShopifyJob(
  supabase: SupabaseClient,
  job: Pick<ShopifySyncJobRow, "id" | "worker_id">,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      status: "succeeded",
      completed_at: now,
      locked_until: null,
      worker_id: null,
      last_error: null,
      updated_at: now,
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("worker_id", job.worker_id)
  if (error) throw new Error(error.message)
}

export async function dbFailShopifyJob(
  supabase: SupabaseClient,
  job: Pick<
    ShopifySyncJobRow,
    "id" | "attempts" | "max_attempts" | "worker_id"
  >,
  errorMessage: string,
): Promise<void> {
  const dead = job.attempts >= job.max_attempts
  const delayMs = Math.min(6 * 60 * 60_000, 2 ** job.attempts * 30_000)
  const { error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      status: dead ? "dead" : "retry",
      run_after: new Date(Date.now() + delayMs).toISOString(),
      locked_until: null,
      worker_id: null,
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("worker_id", job.worker_id)
  if (error) throw new Error(error.message)
}

export async function dbDeferShopifyJob(
  supabase: SupabaseClient,
  job: Pick<ShopifySyncJobRow, "id" | "attempts" | "worker_id">,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      status: "queued",
      attempts: Math.max(0, job.attempts - 1),
      run_after: new Date(Date.now() + 15 * 60_000).toISOString(),
      locked_until: null,
      worker_id: null,
      last_error: reason.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("worker_id", job.worker_id)
  if (error) throw new Error(error.message)
}

export async function dbCancelShopifyJobsForConnection(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      status: "canceled",
      locked_until: null,
      worker_id: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("connection_id", connectionId)
    .in("status", ["queued", "retry", "processing"])
    .neq("job_type", "inventory_decrement")
  if (error) throw new Error(error.message)
}

export async function dbCountUnresolvedShopifyInventoryJobs(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("shopify_sync_jobs")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .eq("job_type", "inventory_decrement")
    .in("status", ["queued", "retry", "processing", "dead"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function dbReviveDeadShopifyInventoryJobs(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const { data, error: listError } = await supabase
    .from("shopify_sync_jobs")
    .select("id, payload")
    .eq("connection_id", connectionId)
    .eq("job_type", "inventory_decrement")
    .eq("status", "dead")
  if (listError) throw new Error(listError.message)

  for (const row of data ?? []) {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? { ...(row.payload as Record<string, unknown>) }
        : {}
    delete payload.locationId
    delete payload.changeFromQuantity
    delete payload.remoteTotalBefore
    const { error } = await supabase
      .from("shopify_sync_jobs")
      .update({
        payload,
        status: "queued",
        attempts: 0,
        run_after: new Date().toISOString(),
        locked_until: null,
        worker_id: null,
        last_error: "Retrying after Shopify reconnection",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "dead")
    if (error) throw new Error(error.message)
  }
}

export async function dbPersistShopifyInventoryAttempt(
  supabase: SupabaseClient,
  input: {
    jobId: string
    workerId: string | null
    payload: Record<string, unknown>
  },
): Promise<void> {
  const { data, error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      payload: input.payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("status", "processing")
    .eq("worker_id", input.workerId)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("Shopify inventory job lease was lost")
}

export async function dbListUnresolvedShopifyInventoryOrderIds(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("shopify_sync_jobs")
    .select("payload")
    .eq("connection_id", connectionId)
    .eq("job_type", "inventory_decrement")
    .in("status", ["queued", "retry", "processing", "dead"])
  if (error) throw new Error(error.message)
  return [
    ...new Set(
      (data ?? [])
        .map((row) => {
          const payload =
            row.payload &&
            typeof row.payload === "object" &&
            !Array.isArray(row.payload)
              ? (row.payload as Record<string, unknown>)
              : {}
          return typeof payload.orderId === "string" ? payload.orderId : null
        })
        .filter((orderId): orderId is string => Boolean(orderId)),
    ),
  ]
}

export async function dbCancelShopifyInventoryJobsForConnection(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_sync_jobs")
    .update({
      status: "canceled",
      locked_until: null,
      worker_id: null,
      completed_at: new Date().toISOString(),
      last_error: "Reswell order compensated after Shopify disconnect",
      updated_at: new Date().toISOString(),
    })
    .eq("connection_id", connectionId)
    .eq("job_type", "inventory_decrement")
    .in("status", ["queued", "retry", "processing", "dead"])
  if (error) throw new Error(error.message)
}
