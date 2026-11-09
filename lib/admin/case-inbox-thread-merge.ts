import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"

function normalizedBody(body: string): string {
  return body.replace(/\s+/g, " ").trim()
}

/**
 * After send, the inbox optimistically appends a `local-*` bubble, then reloads
 * the thread. If the server list is empty/partial (e.g. missing `metadata`
 * column), keep those local agent/note bubbles until the payload includes them.
 */
export function mergeThreadMessagesWithPendingLocal(
  prev: SupportCaseThreadMessage[],
  serverMessages: SupportCaseThreadMessage[],
): SupportCaseThreadMessage[] {
  if (serverMessages.length === 0 && prev.length > 0) return prev

  const serverAgentBodies = new Set(
    serverMessages
      .filter((message) => message.author_role === "agent" && !message.is_internal)
      .map((message) => normalizedBody(message.body)),
  )
  const serverCustomerBodies = new Set(
    serverMessages
      .filter((message) => message.author_role === "customer" && !message.is_internal)
      .map((message) => normalizedBody(message.body)),
  )
  const serverNoteBodies = new Set(
    serverMessages
      .filter((message) => message.is_internal)
      .map((message) => normalizedBody(message.body)),
  )
  const pendingLocal = prev.filter((message) => {
    if (!message.id.startsWith("local-")) return false
    const body = normalizedBody(message.body)
    if (message.is_internal) return !serverNoteBodies.has(body)
    if (message.author_role === "agent") return !serverAgentBodies.has(body)
    if (message.author_role === "customer") return !serverCustomerBodies.has(body)
    return false
  })
  if (pendingLocal.length === 0) return serverMessages
  return [...serverMessages, ...pendingLocal].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}
