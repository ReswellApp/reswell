import type { SupabaseClient } from "@supabase/supabase-js"

export type AccessSignalKind = "ip" | "device"

export type UserAccessSignalRow = {
  lastIpHash: string | null
  lastDeviceHash: string | null
}

export async function upsertUserAccessSignals(
  supabase: SupabaseClient,
  userId: string,
  input: { ipHash?: string | null; deviceHash?: string | null },
): Promise<boolean> {
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
    console.error("[upsertUserAccessSignals]", error.message)
    return false
  }
  return true
}

export async function fetchUserAccessSignals(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAccessSignalRow | null> {
  const { data, error } = await supabase
    .from("user_access_signals")
    .select("last_ip_hash, last_device_hash")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[fetchUserAccessSignals]", error.message)
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
    console.error("[upsertBannedAccessSignal]", error.message)
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
  const { data, error } = await supabase
    .from("banned_access_signals")
    .select("id, expires_at")
    .eq("kind", kind)
    .eq("signal_hash", signalHash)
    .maybeSingle()

  if (error) {
    console.error("[findActiveBannedAccessSignal]", error.message)
    return null
  }
  if (!data) return false
  if (typeof data.expires_at === "string" && data.expires_at <= nowIso) return false
  return true
}
