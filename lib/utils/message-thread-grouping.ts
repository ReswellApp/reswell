export type MessageBubbleGroup = "single" | "first" | "middle" | "last"

/**
 * App-style threading: a new run of bubbles (and a centered time/day label)
 * starts when the calendar day changes or messages are more than this far apart.
 */
export const MESSAGE_GROUP_GAP_MS = 45 * 60 * 1000

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function shouldBreakMessageGroup(prevIso: string | null, currentIso: string): boolean {
  if (!prevIso) return true
  const prev = new Date(prevIso)
  const current = new Date(currentIso)
  if (Number.isNaN(prev.getTime()) || Number.isNaN(current.getTime())) return true
  if (!isSameCalendarDay(prev, current)) return true
  return current.getTime() - prev.getTime() > MESSAGE_GROUP_GAP_MS
}

export function messageBubbleGroup(
  groupedWithPrev: boolean,
  groupedWithNext: boolean,
): MessageBubbleGroup {
  if (!groupedWithPrev && !groupedWithNext) return "single"
  if (!groupedWithPrev && groupedWithNext) return "first"
  if (groupedWithPrev && groupedWithNext) return "middle"
  return "last"
}
