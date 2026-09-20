export function mergeLiveChatUiMessages<
  T extends { id: string; created_at: string },
>(prev: T[], incoming: T): T[] {
  const index = prev.findIndex((message) => message.id === incoming.id)
  if (index === -1) {
    return [...prev, incoming].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
  }
  const next = [...prev]
  next[index] = { ...next[index], ...incoming }
  return next
}
