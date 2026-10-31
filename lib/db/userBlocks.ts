import type { SupabaseClient } from "@supabase/supabase-js"

export type UserBlockRow = {
  blocker_id: string
  blocked_id: string
  created_at: string
}

/** True when either person has blocked the other. */
export async function areUsersBlockedEitherWay(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
    )
    .limit(1)
  if (error) {
    console.error("[userBlocks] areUsersBlockedEitherWay:", error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function listBlockedUserIds(
  supabase: SupabaseClient,
  blockerId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
  if (error) {
    console.error("[userBlocks] listBlockedUserIds:", error.message)
    return []
  }
  return (data ?? [])
    .map((row) => (typeof row.blocked_id === "string" ? row.blocked_id : null))
    .filter((id): id is string => Boolean(id))
}

export async function insertUserBlock(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (blockerId === blockedId) {
    return { ok: false, error: "You can't block yourself." }
  }
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
  )
  if (error) {
    console.error("[userBlocks] insertUserBlock:", error.message)
    return { ok: false, error: "Couldn't block that member." }
  }
  return { ok: true }
}

export async function deleteUserBlock(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
  if (error) {
    console.error("[userBlocks] deleteUserBlock:", error.message)
    return { ok: false, error: "Couldn't unblock that member." }
  }
  return { ok: true }
}
