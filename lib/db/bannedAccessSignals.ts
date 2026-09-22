import type { SupabaseClient } from "@supabase/supabase-js"

export type AccessSignalKind = "ip" | "device"

export type UserAccessSignalRow = {
  lastIpHash: string | null
  lastDeviceHash: string | null
}

/** Skip lookups this long after PostgREST says the tables are not in the schema cache. */
export const ACCESS_SIGNAL_SCHEMA_MISS_TTL_MS = 10 * 60 * 1000

let schemaUnavailableUntilMs = 0
let loggedSchemaMiss = false

export function isAccessSignalSchemaCacheError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false
  if (error.code === "PGRST205") return true
  const msg = (error.message ?? "").toLowerCase()
  if (!msg.includes("schema cache")) return false
  return (
    msg.includes("banned_access_signals") || msg.includes("user_access_signals")
  )
}

export function isAccessSignalSchemaUnavailable(nowMs = Date.now()): boolean {
  return nowMs < schemaUnavailableUntilMs
}

export function resetAccessSignalSchemaCircuit(nowMs = 0): void {
  schemaUnavailableUntilMs = nowMs
  loggedSchemaMiss = false
}

function markAccessSignalSchemaUnavailable(nowMs = Date.now()): void {
  schemaUnavailableUntilMs = nowMs + ACCESS_SIGNAL_SCHEMA_MISS_TTL_MS
  if (!loggedSchemaMiss) {
    loggedSchemaMiss = true
    console.warn(
      "[bannedAccessSignals] tables missing from PostgREST schema cache; skipping lookups for 10m. Apply 20270929140000_banned_access_signals.sql and reload the API schema.",
    )
  }
}

function noteAccessSignalError(
  context: string,
  error: { code?: string; message?: string },
): void {
  if (isAccessSignalSchemaCacheError(error)) {
    markAccessSignalSchemaUnavailable()
    return
  }
  console.error(`[${context}]`, error.message)
}

export async function upsertUserAccessSignals(
  supabase: SupabaseClient,
  userId: string,
  input: { ipHash?: string | null; deviceHash?: string | null },
): Promise<boolean> {
  if (isAccessSignalSchemaUnavailable()) return false

  const { error } = await supabase.from("user_access_signals").upsert(
    {
      user_id: userId,
      last_ip_hash: input.ipHash ?? null,
      last_device_hash: input.deviceHash ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) {
    noteAccessSignalError("upsertUserAccessSignals", error)
    return false
  }
  return true
}

export async function fetchUserAccessSignals(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAccessSignalRow | null> {
  if (isAccessSignalSchemaUnavailable()) return null

  const { data, error } = await supabase
    .from("user_access_signals")
    .select("last_ip_hash, last_device_hash")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    noteAccessSignalError("fetchUserAccessSignals", error)
    return null
  }
  if (!data) return { lastIpHash: null, lastDeviceHash: null }

  return {
    lastIpHash: typeof data.last_ip_hash === "string" ? data.last_ip_hash : null,
    lastDeviceHash: typeof data.last_device_hash === "string" ? data.last_device_hash : null,
  }
}

export async function upsertBannedAccessSignal(
  supabase: SupabaseClient,
  input: {
    kind: AccessSignalKind
    signalHash: string
    sourceUserId: string
    reason: string
    expiresAt: string | null
  },
): Promise<boolean> {
  if (isAccessSignalSchemaUnavailable()) return false

  const { error } = await supabase.from("banned_access_signals").upsert(
    {
      kind: input.kind,
      signal_hash: input.signalHash,
      source_user_id: input.sourceUserId,
      reason: input.reason,
      expires_at: input.expiresAt,
    },
    { onConflict: "kind,signal_hash" },
  )

  if (error) {
    noteAccessSignalError("upsertBannedAccessSignal", error)
    return false
  }
  return true
}

export async function findActiveBannedAccessSignal(
  supabase: SupabaseClient,
  kind: AccessSignalKind,
  signalHash: string,
  nowIso = new Date().toISOString(),
): Promise<boolean | null> {
  if (isAccessSignalSchemaUnavailable()) return null

  const { data, error } = await supabase
    .from("banned_access_signals")
    .select("id, expires_at")
    .eq("kind", kind)
    .eq("signal_hash", signalHash)
    .maybeSingle()

  if (error) {
    noteAccessSignalError("findActiveBannedAccessSignal", error)
    return null
  }
  if (!data) return false
  if (typeof data.expires_at === "string" && data.expires_at <= nowIso) return false
  return true
}
