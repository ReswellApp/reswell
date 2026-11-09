import type { SupabaseClient } from "@supabase/supabase-js"
import { listSupportCasesForRequester } from "@/lib/db/supportCases"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import {
  SUPPORT_INBOX_ACTIVITY_AGENT_BATCH_LIMIT,
  latestAgentCreatedAtByCaseId,
  remainingSupportActivityCaseIds,
  supportCaseToInboxNotification,
  type SupportActivityAgentMessage,
} from "@/lib/utils/support-inbox-activity"
import { countUnreadSupportMessages } from "@/lib/utils/unread-support-count-events"

type PublicAgentMessageRow = SupportActivityAgentMessage & {
  author_role: string
  is_internal?: boolean
  created_at: string
}

async function loadPublicAgentMessagesForCases(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<PublicAgentMessageRow[]> {
  const messages: PublicAgentMessageRow[] = []
  let remaining = caseIds

  while (remaining.length > 0) {
    const { data, error } = await supabase
      .from("support_case_messages")
      .select("case_id, created_at, author_role, is_internal")
      .in("case_id", remaining)
      .eq("author_role", "agent")
      .eq("is_internal", false)
      .order("created_at", { ascending: false })
      .limit(SUPPORT_INBOX_ACTIVITY_AGENT_BATCH_LIMIT)

    if (error) {
      console.warn("[supportInboxActivity] agent messages skipped:", error.message)
      return messages
    }

    const page = (data ?? []) as PublicAgentMessageRow[]
    messages.push(...page)
    const nextRemaining = remainingSupportActivityCaseIds({
      caseIds: remaining,
      page,
      batchLimit: SUPPORT_INBOX_ACTIVITY_AGENT_BATCH_LIMIT,
    })
    if (nextRemaining.length >= remaining.length) break
    remaining = nextRemaining
  }

  return messages
}

/** Reswell replies on the member's cases, shaped for Messages Activity. */
export async function loadSupportInboxActivityNotifications(
  supabase: SupabaseClient,
  userId: string,
  options?: { caseLimit?: number },
): Promise<MessagesInboxNotification[]> {
  const caseLimit =
    typeof options?.caseLimit === "number" &&
    Number.isFinite(options.caseLimit) &&
    options.caseLimit > 0
      ? Math.min(30, Math.floor(options.caseLimit))
      : 30

  const cases = await listSupportCasesForRequester(supabase, userId, "all", {
    limit: caseLimit,
  })
  const visible = cases
  if (visible.length === 0) return []

  const agentMessages = await loadPublicAgentMessagesForCases(
    supabase,
    visible.map((row) => row.id),
  )
  const latestByCase = latestAgentCreatedAtByCaseId(agentMessages)

  const items: MessagesInboxNotification[] = []
  for (const row of visible) {
    const latestAgentAt = latestByCase.get(row.id)
    if (!latestAgentAt) continue
    const unreadCount =
      row.status === "resolved"
        ? 0
        : countUnreadSupportMessages(
            agentMessages.filter((message) => String(message.case_id) === row.id),
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
