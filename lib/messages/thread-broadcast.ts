import {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceInboxChannel,
  marketplaceThreadBroadcastMessageSchema,
  marketplaceThreadChannel,
  type MarketplaceThreadBroadcastMessage,
} from "@reswell/api-contract"

export {
  MARKETPLACE_THREAD_MESSAGE_EVENT,
  MARKETPLACE_THREAD_REFRESH_EVENT,
  marketplaceInboxChannel,
  marketplaceThreadBroadcastMessageSchema,
  marketplaceThreadChannel,
  marketplaceThreadRefreshSchema,
  type MarketplaceThreadBroadcastMessage,
} from "@reswell/api-contract"

export type MarketplaceRealtimeBroadcast = {
  topic: string
  event: string
  payload: MarketplaceThreadBroadcastMessage | { conversation_id: string }
}

function uniqueParticipantIds(participantIds: readonly string[]): string[] {
  return [...new Set(participantIds.filter((id) => id.length > 0))]
}

/** Open-thread bubble plus one inbox event per participant, so badges move without a postgres change. */
export function marketplaceInsertedMessageBroadcasts(
  message: MarketplaceThreadBroadcastMessage,
  participantIds: readonly string[],
): MarketplaceRealtimeBroadcast[] {
  const thread: MarketplaceRealtimeBroadcast = {
    topic: marketplaceThreadChannel(message.conversation_id),
    event: MARKETPLACE_THREAD_MESSAGE_EVENT,
    payload: message,
  }
  const inboxes = uniqueParticipantIds(participantIds).map((userId) => ({
    topic: marketplaceInboxChannel(userId),
    event: MARKETPLACE_THREAD_MESSAGE_EVENT,
    payload: message,
  }))
  return [thread, ...inboxes]
}

/** Offer rewrites: the open thread and each inbox reload once. */
export function marketplaceThreadRefreshBroadcasts(
  conversationId: string,
  participantIds: readonly string[],
): MarketplaceRealtimeBroadcast[] {
  const payload = { conversation_id: conversationId }
  const thread: MarketplaceRealtimeBroadcast = {
    topic: marketplaceThreadChannel(conversationId),
    event: MARKETPLACE_THREAD_REFRESH_EVENT,
    payload,
  }
  const inboxes = uniqueParticipantIds(participantIds).map((userId) => ({
    topic: marketplaceInboxChannel(userId),
    event: MARKETPLACE_THREAD_REFRESH_EVENT,
    payload,
  }))
  return [thread, ...inboxes]
}

/**
 * One Realtime REST broadcast. `private: true` so only subscribers who pass
 * the realtime.messages policy receive the payload.
 */
export function marketplaceRealtimeBroadcastHttpRequest(args: {
  supabaseUrl: string
  messages: readonly MarketplaceRealtimeBroadcast[]
}): {
  url: string
  body: {
    messages: Array<MarketplaceRealtimeBroadcast & { private: true }>
  }
} {
  return {
    url: `${args.supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
    body: {
      messages: args.messages.map((message) => ({
        ...message,
        private: true as const,
      })),
    },
  }
}

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
