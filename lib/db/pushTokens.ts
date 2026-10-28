import type { SupabaseClient } from "@supabase/supabase-js"
import {
  anyPushTopicEnabled,
  defaultPushTopics,
  effectivePushTopics,
  pushPreferenceColumns,
  type PushPreferenceRow,
  type PushTopic,
  type PushTopicFlags,
} from "@/lib/utils/push-topics"

const PUSH_PREF_COLUMNS =
  "user_id, push_opt_in, push_messages, push_offers, push_saves, push_follows, push_orders"

const CHUNK = 80

export type DevicePushPlatform = "ios" | "android"

export interface DevicePushTokenRow {
  user_id: string
  expo_push_token: string
}

export async function upsertDevicePushToken(
  supabase: SupabaseClient,
  input: {
    userId: string
    token: string
    platform: DevicePushPlatform
    deviceId: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { error: clearError } = await supabase
    .from("device_push_tokens")
    .delete()
    .eq("expo_push_token", input.token)
  if (clearError) {
    console.error("[pushTokens] reassign failed", {
      timestamp: now,
      message: clearError.message,
    })
    return { ok: false, error: "Unable to save this device right now" }
  }

  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: input.userId,
      expo_push_token: input.token,
      platform: input.platform,
      device_id: input.deviceId,
      disabled_at: null,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,device_id" },
  )
  if (error) {
    console.error("[pushTokens] upsert failed", {
      timestamp: now,
      message: error.message,
    })
    return { ok: false, error: "Unable to save this device right now" }
  }
  return { ok: true }
}

export async function deleteDevicePushToken(
  supabase: SupabaseClient,
  userId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("device_push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("expo_push_token", token)
  if (error) {
    console.error("[pushTokens] delete failed", {
      timestamp: new Date().toISOString(),
      message: error.message,
    })
    return { ok: false, error: "Unable to remove this device right now" }
  }
  return { ok: true }
}

export async function listActivePushTokensForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<DevicePushTokenRow[]> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const rows: DevicePushTokenRow[] = []
  for (const ids of chunks(unique, CHUNK)) {
    const { data, error } = await supabase
      .from("device_push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", ids)
      .is("disabled_at", null)
    if (error) {
      throw new Error(`push token read failed: ${error.message}`)
    }
    for (const row of (data ?? []) as DevicePushTokenRow[]) {
      if (row.user_id && row.expo_push_token) rows.push(row)
    }
  }
  return rows
}

export async function disablePushTokens(
  supabase: SupabaseClient,
  tokens: string[],
): Promise<void> {
  const unique = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))]
  if (unique.length === 0) return
  const now = new Date().toISOString()
  for (const batch of chunks(unique, CHUNK)) {
    const { error } = await supabase
      .from("device_push_tokens")
      .update({ disabled_at: now, updated_at: now })
      .in("expo_push_token", batch)
      .is("disabled_at", null)
    if (error) {
      throw new Error(`push token disable failed: ${error.message}`)
    }
  }
}

export async function getPushTopicFlagsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PushTopicFlags> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(PUSH_PREF_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    console.error("[pushTokens] get topics:", error)
    return defaultPushTopics()
  }
  return effectivePushTopics(data as PushPreferenceRow | null)
}

export async function getPushOptInForUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return anyPushTopicEnabled(await getPushTopicFlagsForUser(supabase, userId))
}

export async function getPushTopicFlagsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, PushTopicFlags>> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  const byUser = new Map<string, PushTopicFlags>()
  if (unique.length === 0) return byUser

  for (const ids of chunks(unique, CHUNK)) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(PUSH_PREF_COLUMNS)
      .in("user_id", ids)
    if (error) throw new Error(`push preference read failed: ${error.message}`)
    for (const row of (data ?? []) as Array<PushPreferenceRow & { user_id: string }>) {
      if (row.user_id) byUser.set(row.user_id, effectivePushTopics(row))
    }
  }
  return byUser
}

export async function upsertPushTopicFlagsForUser(
  supabase: SupabaseClient,
  userId: string,
  flags: PushTopicFlags,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      ...pushPreferenceColumns(flags),
    },
    { onConflict: "user_id" },
  )
  if (error) {
    console.error("[pushTokens] upsert topics:", error)
    return { ok: false, error: "Failed to save preference." }
  }
  return { ok: true }
}

export async function upsertPushOptInForUser(
  supabase: SupabaseClient,
  userId: string,
  pushOptIn: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = pushOptIn ? defaultPushTopics() : {
    messages: false,
    offers: false,
    saves: false,
    follows: false,
    orders: false,
  }
  return upsertPushTopicFlagsForUser(supabase, userId, current)
}

export async function patchPushTopicForUser(
  supabase: SupabaseClient,
  userId: string,
  topic: PushTopic,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getPushTopicFlagsForUser(supabase, userId)
  return upsertPushTopicFlagsForUser(supabase, userId, { ...current, [topic]: enabled })
}

function chunks<T>(values: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}
