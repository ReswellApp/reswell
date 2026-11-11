export const MESSAGE_GROUP_GAP_MS = 45 * 60 * 1000

/** UTC calendar day — matches on the server and in every browser timezone. */
export function isSameUtcCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

/**
 * Start a new bubble run when messages are far apart or on different UTC days.
 * Local calendar days would disagree with SSR (Vercel UTC vs Pacific users)
 * and throw React minified error #418.
 */
export function shouldBreakMessageGroup(prevIso: string | null, currentIso: string): boolean {
  if (!prevIso) return true
  const prev = new Date(prevIso)
  const current = new Date(currentIso)
  if (Number.isNaN(prev.getTime()) || Number.isNaN(current.getTime())) return true
  if (!isSameUtcCalendarDay(prev, current)) return true
  return current.getTime() - prev.getTime() > MESSAGE_GROUP_GAP_MS
}
