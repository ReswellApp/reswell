export const UNREAD_SUPPORT_COUNT_ADJUST_EVENT = "unreadSupportCountAdjust"
export const UNREAD_SUPPORT_COUNT_REFRESH_EVENT = "unreadSupportCountRefresh"
export const UNREAD_SUPPORT_COUNT_SET_EVENT = "unreadSupportCountSet"

export type UnreadSupportCountAdjustDetail = {
  delta: number
}

export type UnreadSupportCountSetDetail = {
  count: number
}

export function dispatchUnreadSupportCountAdjust(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return
  window.dispatchEvent(
    new CustomEvent<UnreadSupportCountAdjustDetail>(UNREAD_SUPPORT_COUNT_ADJUST_EVENT, {
      detail: { delta },
    }),
  )
}

export function dispatchUnreadSupportCountRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(UNREAD_SUPPORT_COUNT_REFRESH_EVENT))
}

export function dispatchUnreadSupportCountSet(count: number): void {
  if (typeof window === "undefined" || !Number.isFinite(count)) return
  window.dispatchEvent(
    new CustomEvent<UnreadSupportCountSetDetail>(UNREAD_SUPPORT_COUNT_SET_EVENT, {
      detail: { count: Math.max(0, count) },
    }),
  )
}

export function countUnreadSupportMessages(
  messages: ReadonlyArray<{ author_role: string; is_internal?: boolean; created_at: string }>,
  lastReadAt: string | null,
): number {
  return messages.filter((message) => {
    if (message.author_role !== "agent" || message.is_internal) return false
    if (!lastReadAt) return true
    return new Date(message.created_at).getTime() > new Date(lastReadAt).getTime()
  }).length
}
