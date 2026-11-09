import {
  isSupportStatusUpdateMessage,
  parseSupportTicketOpeningContent,
  parseSupportTicketStatusContent,
} from "@/lib/messages/parse-support-thread-message"
import type { SupportCaseMessageRow } from "@/lib/db/supportCases"

export type LeftoverSupportDmMessage = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

export function normalizedSupportMessageBody(body: string): string {
  return body.replace(/\s+/g, " ").trim()
}

/**
 * Public customer/agent chat lines dedupe by body only so a leftover DM with the
 * wrong author_role cannot re-introduce the same reply on the opposite side.
 * Canonical `existing` rows are pushed first and win.
 */
function historyKey(message: Pick<SupportCaseMessageRow, "author_role" | "body" | "is_internal">): string {
  const body = normalizedSupportMessageBody(message.body)
  if (
    !message.is_internal &&
    (message.author_role === "customer" || message.author_role === "agent")
  ) {
    return `public:chat:${body}`
  }
  return `${message.is_internal ? "internal" : "public"}:${message.author_role}:${body}`
}

export function supportThreadHasReadableHistory(
  messages: Array<Pick<SupportCaseMessageRow, "author_role" | "body" | "is_internal">>,
): boolean {
  return messages.some(
    (message) =>
      !message.is_internal &&
      (message.author_role === "customer" || message.author_role === "agent") &&
      normalizedSupportMessageBody(message.body).length > 0 &&
      !isSupportStatusUpdateMessage(message.body),
  )
}

export function leftoverSupportDmToCaseMessage(args: {
  caseId: string
  requesterUserId: string | null
  leftover: LeftoverSupportDmMessage
}): SupportCaseMessageRow | null {
  const content = args.leftover.content.trim()
  if (!content) return null

  const status = parseSupportTicketStatusContent(content)
  if (status || isSupportStatusUpdateMessage(content)) {
    return {
      id: args.leftover.id,
      case_id: args.caseId,
      author_user_id: null,
      author_role: "system",
      body: status?.line ?? content,
      is_internal: false,
      metadata: {},
      created_at: args.leftover.created_at,
    }
  }

  const opening = parseSupportTicketOpeningContent(content)
  if (opening) {
    return {
      id: args.leftover.id,
      case_id: args.caseId,
      author_user_id: args.requesterUserId,
      author_role: "customer",
      body: opening.body,
      is_internal: false,
      metadata: {},
      created_at: args.leftover.created_at,
    }
  }

  const mine = Boolean(args.requesterUserId && args.leftover.sender_id === args.requesterUserId)
  return {
    id: args.leftover.id,
    case_id: args.caseId,
    author_user_id: args.leftover.sender_id,
    author_role: mine ? "customer" : "agent",
    body: content,
    is_internal: false,
    metadata: {},
    created_at: args.leftover.created_at,
  }
}

export function seedOpeningSupportCaseMessage(args: {
  caseId: string
  requesterUserId: string | null
  body: string
  createdAt: string
}): SupportCaseMessageRow | null {
  const body = args.body.trim()
  if (!body || isSupportStatusUpdateMessage(body)) return null
  return {
    id: args.caseId,
    case_id: args.caseId,
    author_user_id: args.requesterUserId,
    author_role: "customer",
    body,
    is_internal: false,
    metadata: {},
    created_at: args.createdAt,
  }
}

/**
 * Prefer the immutable contact/order request body. `support_cases.preview` tracks
 * the latest snippet and becomes the staff reply after an admin sends — never use
 * that as the customer opening when a sidecar body exists, and skip it when it
 * already matches a staff reply in the thread.
 */
export function resolveSupportCaseOpeningBody(args: {
  preview: string | null | undefined
  contactMessage?: string | null
  orderBody?: string | null
  existing?: Array<Pick<SupportCaseMessageRow, "author_role" | "body" | "is_internal">>
}): string {
  const fromContact = normalizedSupportMessageBody(args.contactMessage ?? "")
  if (fromContact) return fromContact

  const fromOrder = normalizedSupportMessageBody(args.orderBody ?? "")
  if (fromOrder) return fromOrder

  const preview = normalizedSupportMessageBody(args.preview ?? "")
  if (!preview) return ""

  const matchesAgent = (args.existing ?? []).some(
    (message) =>
      message.author_role === "agent" &&
      !message.is_internal &&
      normalizedSupportMessageBody(message.body) === preview,
  )
  if (matchesAgent) return ""

  return preview
}

/**
 * Keep resolved / migrated help threads readable. Canonical rows stay first;
 * leftover dual-written support DMs fill gaps, and the original request is
 * seeded when nothing else remains.
 */
export function restoreSupportThreadHistory(args: {
  existing: SupportCaseMessageRow[]
  leftover: LeftoverSupportDmMessage[]
  requesterUserId: string | null
  caseId: string
  openingBody: string | null
  createdAt: string
}): SupportCaseMessageRow[] {
  const merged: SupportCaseMessageRow[] = []
  const seen = new Set<string>()

  const push = (message: SupportCaseMessageRow | null) => {
    if (!message || !normalizedSupportMessageBody(message.body)) return
    const key = historyKey(message)
    if (seen.has(key)) return
    seen.add(key)
    merged.push(message)
  }

  for (const message of args.existing) push(message)
  for (const leftover of args.leftover) {
    push(
      leftoverSupportDmToCaseMessage({
        caseId: args.caseId,
        requesterUserId: args.requesterUserId,
        leftover,
      }),
    )
  }

  if (!supportThreadHasReadableHistory(merged)) {
    const opening = normalizedSupportMessageBody(args.openingBody ?? "")
    const openingMatchesAgent = merged.some(
      (message) =>
        message.author_role === "agent" &&
        !message.is_internal &&
        normalizedSupportMessageBody(message.body) === opening,
    )
    if (opening && !openingMatchesAgent) {
      push(
        seedOpeningSupportCaseMessage({
          caseId: args.caseId,
          requesterUserId: args.requesterUserId,
          body: opening,
          createdAt: args.createdAt,
        }),
      )
    }
  }

  return merged.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}
