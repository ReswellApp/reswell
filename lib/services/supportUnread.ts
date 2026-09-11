import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
export async function markSupportCaseReadForMember(
  supabase: SupabaseClient,
  _userId: string,
  caseId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("mark_support_case_read", {
    p_case_id: caseId,
  })
  if (error) {
    console.warn("[supportUnread] mark read skipped:", error.message)
    return 0
  }
  return typeof data === "number" && Number.isFinite(data) ? Math.max(0, data) : 0
}

export async function countUnreadSupportForUser(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("unread_support_count")
    .eq("id", userId)
    .maybeSingle()
  if (error) {
    console.warn("[supportUnread] count skipped:", error.message)
    return 0
  }
  const next = Number(data?.unread_support_count ?? 0)
  return Number.isFinite(next) ? Math.max(0, next) : 0
}
