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

type IncomingLiveChatMessage = {
  id: string
  created_at: string
  sender_type?: string
  content?: string
  pending?: boolean
}

/** Widget/session merge: replace same-id rows (regenerate) and confirm pending visitor sends. */
export function mergeIncomingLiveChatUiMessage<T extends IncomingLiveChatMessage>(
  prev: T[],
  incoming: T,
): T[] {
  if (incoming.sender_type === "visitor" && !incoming.pending) {
    const pendingIndex = prev.findIndex(
      (message) =>
        message.pending &&
        message.sender_type === "visitor" &&
        message.content === incoming.content,
    )
    if (pendingIndex >= 0) {
      const next = [...prev]
      next[pendingIndex] = { ...incoming, pending: false }
      return next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    }
  }
  return mergeLiveChatUiMessages(prev, incoming)
}
