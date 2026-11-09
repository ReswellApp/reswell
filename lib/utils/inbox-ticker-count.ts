/** Website header badge: unread marketplace DMs + unread support replies. */
export function inboxTickerCount(unreadMessages: number, unreadSupport: number): number {
  return clampCount(unreadMessages) + clampCount(unreadSupport)
}

function clampCount(value: number): number {
  return Math.max(0, Math.floor(Number(value) || 0))
}
