import { z } from "zod"

/** Channel name shared by the open thread and the server broadcast. */
export function marketplaceThreadChannel(conversationId: string): string {
  return `marketplace-thread:${conversationId}`
}

export const MARKETPLACE_THREAD_MESSAGE_EVENT = "message"
export const MARKETPLACE_THREAD_REFRESH_EVENT = "refresh"

export const marketplaceThreadBroadcastMessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string().min(1),
  is_read: z.boolean().nullable().optional(),
  offer_id: z.string().uuid().nullable().optional(),
  metadata: z.unknown().optional(),
})

export type MarketplaceThreadBroadcastMessage = z.infer<
  typeof marketplaceThreadBroadcastMessageSchema
>

export const marketplaceThreadRefreshSchema = z.object({
  conversation_id: z.string().uuid(),
})

/**
 * One Realtime REST broadcast. `private: true` so only participants who pass
 * the realtime.messages policy receive the payload.
 */
export function marketplaceThreadBroadcastHttpRequest(args: {
  supabaseUrl: string
  conversationId: string
  event: typeof MARKETPLACE_THREAD_MESSAGE_EVENT | typeof MARKETPLACE_THREAD_REFRESH_EVENT
  payload: MarketplaceThreadBroadcastMessage | { conversation_id: string }
}): {
  url: string
  body: {
    messages: Array<{
      topic: string
      event: string
      payload: MarketplaceThreadBroadcastMessage | { conversation_id: string }
      private: true
    }>
  }
} {
  return {
    url: `${args.supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
    body: {
      messages: [
        {
          topic: marketplaceThreadChannel(args.conversationId),
          event: args.event,
          payload: args.payload,
          private: true,
        },
      ],
    },
  }
}

export function marketplaceThreadMessageFromRow(
  row: unknown,
  conversationId?: string,
): MarketplaceThreadBroadcastMessage | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  const parsed = marketplaceThreadBroadcastMessageSchema.safeParse({
    id: record.id,
    conversation_id: record.conversation_id ?? conversationId,
    sender_id: record.sender_id,
    content: record.content,
    created_at: record.created_at,
    is_read: record.is_read,
    offer_id: record.offer_id,
    metadata: record.metadata,
  })
  if (!parsed.success) return null
  return parsed.data
}
