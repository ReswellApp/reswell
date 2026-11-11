export type MessageBubbleGroup = "single" | "first" | "middle" | "last"

export { MESSAGE_GROUP_GAP_MS, shouldBreakMessageGroup } from "./message-group-break"

export function messageBubbleGroup(
  groupedWithPrev: boolean,
  groupedWithNext: boolean,
): MessageBubbleGroup {
  if (!groupedWithPrev && !groupedWithNext) return "single"
  if (!groupedWithPrev && groupedWithNext) return "first"
  if (groupedWithPrev && groupedWithNext) return "middle"
  return "last"
}
