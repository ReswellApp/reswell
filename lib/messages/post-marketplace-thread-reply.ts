import { retryOnceOnAbort } from "@/lib/utils/retry-on-abort"

export type MarketplaceThreadReplyResult =
  | {
      success: true
      message: {
        id: string
        content: string
        sender_id: string
        created_at: string
        is_read?: boolean
        metadata?: unknown
      }
    }
  | {
      error: string
      policyReason?: string
      restrictionCode?: string
      restrictedUntil?: string
    }

const inFlight = new Map<string, Promise<MarketplaceThreadReplyResult>>()

function sendKey(conversationId: string, clientId: string): string {
  return `${conversationId}:${clientId}`
}

function parseReplyResult(json: unknown): MarketplaceThreadReplyResult {
  if (!json || typeof json !== "object") {
    return { error: "Failed to send message" }
  }
  const row = json as {
    success?: unknown
    message?: {
      id?: unknown
      content?: unknown
      sender_id?: unknown
      created_at?: unknown
      is_read?: unknown
      metadata?: unknown
    }
    error?: unknown
    policyReason?: unknown
    restrictionCode?: unknown
    restrictedUntil?: unknown
  }
  if (
    row.success === true &&
    row.message &&
    typeof row.message.id === "string" &&
    typeof row.message.content === "string" &&
    typeof row.message.sender_id === "string" &&
    typeof row.message.created_at === "string"
  ) {
    return {
      success: true,
      message: {
        id: row.message.id,
        content: row.message.content,
        sender_id: row.message.sender_id,
        created_at: row.message.created_at,
        is_read: row.message.is_read === true,
        metadata: row.message.metadata,
      },
    }
  }
  if (typeof row.error === "string" && row.error.trim()) {
    return {
      error: row.error,
      ...(typeof row.policyReason === "string" ? { policyReason: row.policyReason } : {}),
      ...(typeof row.restrictionCode === "string" ? { restrictionCode: row.restrictionCode } : {}),
      ...(typeof row.restrictedUntil === "string" ? { restrictedUntil: row.restrictedUntil } : {}),
    }
  }
  return { error: "Failed to send message" }
}

async function postReplyOnce(input: {
  conversationId: string
  content: string
  composerUnlockToken: string
  clientId: string
}): Promise<MarketplaceThreadReplyResult> {
  const res = await fetch("/api/messages/send", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({
      conversation_id: input.conversationId,
      content: input.content,
      composer_unlock_token: input.composerUnlockToken,
      client_id: input.clientId,
    }),
  })
  return parseReplyResult(await res.json().catch(() => null))
}

/**
 * POST /api/messages/send with keepalive so the insert outlives leaving the thread.
 * Dedupes by client id so a remount does not start a second request for the same bubble.
 * Retries once on navigation abort; the server treats `client_id` as idempotent.
 */
export function postMarketplaceThreadReply(input: {
  conversationId: string
  content: string
  composerUnlockToken: string
  clientId: string
}): Promise<MarketplaceThreadReplyResult> {
  const key = sendKey(input.conversationId, input.clientId)
  const existing = inFlight.get(key)
  if (existing) return existing

  const work = retryOnceOnAbort(() => postReplyOnce(input)).catch(
    (): MarketplaceThreadReplyResult => ({ error: "Failed to send message" }),
  )

  inFlight.set(key, work)
  void work.finally(() => {
    inFlight.delete(key)
  })
  return work
}
