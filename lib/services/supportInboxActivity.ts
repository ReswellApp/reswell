import type { SupabaseClient } from "@supabase/supabase-js"
import { listSupportCasesForRequester } from "@/lib/db/supportCases"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import { supportCaseToInboxNotification } from "@/lib/utils/support-inbox-activity"
import { countUnreadSupportMessages } from "@/lib/utils/unread-support-count-events"

/** Reswell replies on the member's cases, shaped for Messages Activity. */
export async function loadSupportInboxActivityNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<MessagesInboxNotification[]> {
  const cases = await listSupportCasesForRequester(supabase, userId, "all")
  const visible = cases.slice(0, 30)
  if (visible.length === 0) return []

  const { data: agentMessages, error } = await supabase
    .from("support_case_messages")
    .select("case_id, created_at, author_role, is_internal")
    .in(
      "case_id",
      visible.map((row) => row.id),
    )
    .eq("author_role", "agent")
    .eq("is_internal", false)
    .order("created_at", { ascending: false })
    .limit(400)

  if (error) {
    console.warn("[supportInboxActivity] agent messages skipped:", error.message)
    return []
  }

  const latestByCase = new Map<string, string>()
  for (const message of agentMessages ?? []) {
    const caseId = String((message as { case_id: string }).case_id)
    if (latestByCase.has(caseId)) continue
    latestByCase.set(caseId, String((message as { created_at: string }).created_at))
  }

  const items: MessagesInboxNotification[] = []
  for (const row of visible) {
    const latestAgentAt = latestByCase.get(row.id)
    if (!latestAgentAt) continue
    const unreadCount =
      row.status === "resolved"
        ? 0
        : countUnreadSupportMessages(
            (agentMessages ?? []).filter(
              (message) => String((message as { case_id: string }).case_id) === row.id,
            ) as Array<{ author_role: string; is_internal?: boolean; created_at: string }>,
            row.requester_last_read_at,
          )
    items.push(
      supportCaseToInboxNotification({
        id: row.id,
        subject: row.subject,
        unreadCount,
        latestAgentAt,
      }),
    )
  }

  return items
}
