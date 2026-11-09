import type { SupabaseClient, User } from "@supabase/supabase-js"
import {
  areUsersBlockedEitherWay,
  deleteUserBlock,
  insertUserBlock,
  listBlockedUserIds,
} from "@/lib/db/userBlocks"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createServiceRoleClient } from "@/lib/supabase/server"

export { areUsersBlockedEitherWay, listBlockedUserIds }

const BLOCKED_MESSAGE = "You can't message this member."

export async function blockUserService(
  supabase: SupabaseClient,
  user: User,
  blockedId: string,
): Promise<MobileApiResult<{ blocked: true }>> {
  const target = blockedId.trim()
  if (!target) return { ok: false, status: 400, error: "Missing member." }
  if (target === user.id) return { ok: false, status: 400, error: "You can't block yourself." }

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", target).maybeSingle()
  if (!profile) return { ok: false, status: 404, error: "Member not found." }

  const inserted = await insertUserBlock(supabase, user.id, target)
  if (!inserted.ok) return { ok: false, status: 500, error: inserted.error }

  // Drop follow both ways so the blocked person stops showing up in feeds.
  try {
    const service = createServiceRoleClient()
    await service.from("seller_follows").delete().eq("follower_id", user.id).eq("seller_id", target)
    await service.from("seller_follows").delete().eq("follower_id", target).eq("seller_id", user.id)
  } catch (error) {
    console.warn("[userBlocks] unfollow after block skipped", error)
  }

  return { ok: true, data: { blocked: true } }
}

export async function unblockUserService(
  supabase: SupabaseClient,
  user: User,
  blockedId: string,
): Promise<MobileApiResult<{ blocked: false }>> {
  const target = blockedId.trim()
  if (!target) return { ok: false, status: 400, error: "Missing member." }
  const removed = await deleteUserBlock(supabase, user.id, target)
  if (!removed.ok) return { ok: false, status: 500, error: removed.error }
  return { ok: true, data: { blocked: false } }
}

export async function listBlockedUsersService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ user_ids: string[] }>> {
  const user_ids = await listBlockedUserIds(supabase, userId)
  return { ok: true, data: { user_ids } }
}

export async function rejectIfMessagingBlocked(
  _supabase: SupabaseClient,
  senderId: string,
  receiverId: string,
): Promise<MobileApiResult<never> | null> {
  // Service role: RLS only lets a member read their own outbound blocks.
  const blocked = await areUsersBlockedEitherWay(createServiceRoleClient(), senderId, receiverId)
  if (!blocked) return null
  return { ok: false, status: 403, error: BLOCKED_MESSAGE }
}
