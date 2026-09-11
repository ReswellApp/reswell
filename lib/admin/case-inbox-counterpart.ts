import type { CaseInboxItem } from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"

export type InboxCounterpartRole = CaseInboxItem["requesterRole"]

export function inboxCounterpartNoun(role: InboxCounterpartRole): "seller" | "buyer" | "member" {
  if (role === "seller") return "seller"
  if (role === "buyer") return "buyer"
  return "member"
}

export function inboxCounterpartLabel(role: InboxCounterpartRole): string {
  const noun = inboxCounterpartNoun(role)
  return noun === "member" ? "Member" : noun === "seller" ? "Seller" : "Buyer"
}

export function staffWaitingStatusLabel(item: Pick<CaseInboxItem, "requesterRole" | "openedBy">): string {
  if (item.openedBy === "staff") {
    return item.requesterRole === "seller"
      ? "Waiting on seller"
      : item.requesterRole === "buyer"
        ? "Waiting on buyer"
        : "Waiting on reply"
  }
  if (item.requesterRole === "seller") return "Waiting on seller"
  if (item.requesterRole === "buyer") return "Waiting on buyer"
  return "Waiting on reply"
}

export function staffWorkflowStatusLabel(
  status: SupportCaseStatus,
  item: Pick<CaseInboxItem, "requesterRole" | "openedBy">,
): string {
  if (status === "waiting_on_you") return staffWaitingStatusLabel(item)
  if (status === "submitted") return "New"
  if (status === "in_review") return "In review"
  if (status === "in_progress") return "Open"
  return "Resolved"
}

export function staffReplyPlaceholder(role: InboxCounterpartRole): string {
  const noun = inboxCounterpartNoun(role)
  if (noun === "member") return "Write a reply they will see…"
  return `Write a reply the ${noun} will see…`
}

export function staffSentToast(role: InboxCounterpartRole): string {
  const noun = inboxCounterpartNoun(role)
  if (noun === "member") return "Sent"
  return `Sent to ${noun}`
}

export function caseHasMemberReply(
  messages: ReadonlyArray<{ author_role: string; is_internal?: boolean }>,
): boolean {
  return messages.some((message) => message.author_role === "customer" && !message.is_internal)
}
